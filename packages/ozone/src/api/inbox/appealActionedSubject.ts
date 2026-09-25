import {
  ForbiddenError,
  InternalServerError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  fileAppeal,
  isAppealWindowOpen,
  isAppealableEvent,
  resolveAppealAction,
  subjectKey,
} from '../../inbox/appeal.js'
import { getSeenAt } from '../../inbox/seen.js'
import { hydrateSubjectView } from '../../inbox/views.js'
import { tools } from '../../lexicons/index.js'
import {
  subjectFromEventRow,
  subjectFromInput,
} from '../../mod-service/subject.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.appealActionedSubject, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { action: actionInput, subject: subjectInput } = input.body
      const requester = auth.credentials.iss
      const canAppealForOthers =
        auth.credentials.isAdmin ||
        auth.credentials.isModerator ||
        auth.credentials.isTriage

      const inputSubject = subjectFromInput(subjectInput)
      const action = await resolveAppealAction(ctx, inputSubject, actionInput)

      // validate action event
      if (action) {
        if (!canAppealForOthers && requester !== action.subjectDid) {
          throw new ForbiddenError(
            'Moderation action is not appealable',
            'NotAppealable',
          )
        }
        if (!isAppealableEvent(action.action)) {
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

      await fileAppeal(ctx, {
        requester,
        subject,
        action: actionInput,
        resolvedActionId: action?.id,
        reason: input.body.reason,
        modTool: input.body.modTool,
      })

      // The appeal report ID stays internal: callers track the appeal through
      // the subject view. Read after the commit so the view reflects the appeal
      // that was just filed, and treat a missing snapshot as a bug rather than
      // papering over it - the subject provably has moderation history, since
      // the write above just added to it.
      const seenAt = await getSeenAt(ctx.db, subject.did, 'subjects')
      const view = await hydrateSubjectView(
        ctx.db,
        subject,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
        seenAt,
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
