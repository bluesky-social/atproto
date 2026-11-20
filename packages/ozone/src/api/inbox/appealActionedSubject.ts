import {
  ForbiddenError,
  InternalServerError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  fileAppeal,
  getAppealableAccountTags,
  isAppealWindowOpen,
  isAppealableEvent,
  resolveAppealAction,
  subjectKey,
} from '../../inbox/appeal.js'
import {
  findLatestAppealableAt,
  hasVisiblePublicAction,
} from '../../inbox/appealable-events.js'
import { getSeenAt } from '../../inbox/seen.js'
import { inboxHasStarted } from '../../inbox/start.js'
import {
  hydrateSubjectView,
  loadSubjectEnforcement,
  toEnforcementView,
} from '../../inbox/views.js'
import { tools } from '../../lexicons/index.js'
import {
  subjectFromEventRow,
  subjectFromInput,
} from '../../mod-service/subject.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.appealActionedSubject, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      if (!inboxHasStarted(ctx.cfg.inbox.startAt)) {
        throw new ForbiddenError(
          'The moderation inbox has not started',
          'NotAppealable',
        )
      }
      const { action: actionInput, subject: subjectInput } = input.body
      const requester = auth.credentials.iss
      const canAppealForOthers =
        auth.credentials.isAdmin ||
        auth.credentials.isModerator ||
        auth.credentials.isTriage

      const inputSubject = subjectFromInput(subjectInput)
      const action = await resolveAppealAction(ctx, inputSubject, actionInput)
      let requireAppealableTag = false
      if (ctx.cfg.inbox.startAt && actionInput && !action) {
        throw new ForbiddenError(
          'No matching moderation action to appeal',
          'NotAppealable',
        )
      }

      // validate action event
      if (action) {
        if (!canAppealForOthers && requester !== action.subjectDid) {
          throw new ForbiddenError(
            'Moderation action is not appealable',
            'NotAppealable',
          )
        }
        if (!isAppealableEvent(action)) {
          throw new ForbiddenError('Subject is not appealable', 'NotAppealable')
        }
        if (
          !isAppealWindowOpen(
            action.createdAt,
            ctx.cfg.inbox.appealWindowMonths,
          )
        ) {
          throw new ForbiddenError(
            'Appeal window has expired',
            'AppealWindowExpired',
          )
        }
      }

      // parse subject and validate
      const subject = action ? subjectFromEventRow(action) : inputSubject
      if (
        inputSubject &&
        action &&
        subjectKey(inputSubject) !== subjectKey(subject)
      ) {
        throw new ForbiddenError('Subject is not appealable', 'NotAppealable')
      }
      if (!canAppealForOthers && requester !== subject.did) {
        throw new ForbiddenError('Subject is not appealable', 'NotAppealable')
      }
      // @NOTE The inbox start date bounds displayed history, not eligibility:
      // a subject actioned before it remains appealable.
      if (ctx.cfg.inbox.startAt && !action) {
        const [latestAppealableAt, snapshot, activeTags] = await Promise.all([
          findLatestAppealableAt(ctx.db, subject),
          loadSubjectEnforcement(ctx.db, subject),
          getAppealableAccountTags(
            ctx.db,
            subject,
            ctx.cfg.inbox.appealableTags ?? [],
          ),
        ])
        const enforcement = toEnforcementView({
          subject,
          status: snapshot.status,
          labels: snapshot.labels,
          actions: [],
        })
        if (
          !latestAppealableAt &&
          enforcement.state === 'none' &&
          !(await hasVisiblePublicAction(
            ctx.db,
            subject,
            ctx.cfg.inbox.startAt,
          ))
        ) {
          if (!activeTags.length) {
            throw new ForbiddenError(
              'Subject has no moderation action to appeal',
              'NotAppealable',
            )
          }
          requireAppealableTag = true
        }
      }

      await fileAppeal(ctx, {
        requester: subject.did,
        submittedBy: requester !== subject.did ? requester : undefined,
        subject,
        action: actionInput,
        resolvedActionId: action?.id,
        resolvedActionAt: action?.createdAt,
        requireAppealableTag,
        reason: input.body.reason,
        modTool: input.body.modTool,
      })

      // The appeal report ID stays internal: callers track the appeal through
      // the subject view. Read after the commit so the view reflects the appeal
      // that was just filed, and treat a missing snapshot as a bug rather than
      // papering over it - the subject provably has moderation history, since
      // the write above just added to it. That history may all predate the
      // inbox start, which hides the actions but not the subject.
      const seenAt = await getSeenAt(ctx.db, subject.did, 'subjects')
      const view = await hydrateSubjectView(
        ctx.db,
        subject,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
        seenAt,
        {
          requireVisibleActions: false,
          hideStatusCreatedAt: requireAppealableTag,
        },
      )
      if (!view) {
        throw new InternalServerError(
          'Appeal was recorded but its subject could not be read back',
        )
      }
      return { encoding: 'application/json', body: view }
    },
  })
}
