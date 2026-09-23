import {
  ForbiddenError,
  InternalServerError,
  InvalidRequestError,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  fileAppeal,
  findAppealedEvent,
  isAppealWindowOpen,
  isAppealableEvent,
  subjectKey,
} from '../../inbox/appeal.js'
import { hydrateSubjectView } from '../../inbox/views.js'
import type { Server } from '../../lexicon/index.js'
import {
  isActionRef,
  isLabelRef,
  isTakedownRef,
} from '../../lexicon/types/tools/ozone/inbox/appealActionedSubject.js'
import { REASONAPPEAL } from '../../lexicon/types/tools/ozone/report/defs.js'
import {
  subjectFromEventRow,
  subjectFromInput,
} from '../../mod-service/subject.js'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.inbox.appealActionedSubject({
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      const { action: actionInput, subject: subjectInput } = input.body
      const requester =
        'iss' in auth.credentials ? auth.credentials.iss : ctx.cfg.service.did

      // validate input
      if (!actionInput && !subjectInput) {
        throw new InvalidRequestError(
          'An action or subject is required',
          'InvalidAppealTarget',
        )
      }
      if (
        actionInput &&
        !isActionRef(actionInput) &&
        !isLabelRef(actionInput) &&
        !isTakedownRef(actionInput)
      ) {
        throw new InvalidRequestError(
          'Unknown appeal action reference',
          'InvalidAppealTarget',
        )
      }
      if (
        actionInput &&
        !isActionRef(actionInput) &&
        subjectInput === undefined
      ) {
        throw new InvalidRequestError(
          'A subject is required for this action reference',
          'InvalidAppealTarget',
        )
      }

      const inputSubject = subjectInput
        ? subjectFromInput(subjectInput)
        : undefined
      const action = isActionRef(actionInput)
        ? await ctx.modService(ctx.db).getEvent(actionInput.id)
        : actionInput && inputSubject
          ? await findAppealedEvent(
              ctx,
              inputSubject,
              isLabelRef(actionInput)
                ? { type: 'label', val: actionInput.val }
                : { type: 'takedown' },
            )
          : undefined
      if (isActionRef(actionInput) && !action) {
        throw new ForbiddenError(
          'Moderation action is not appealable',
          'NotAppealable',
        )
      }

      // validate action event
      if (action) {
        if (requester !== action.subjectDid) {
          throw new ForbiddenError(
            'Moderation action is not appealable',
            'NotAppealable',
          )
        }
        if (!isAppealableEvent(action.action)) {
          throw new ForbiddenError('Target is not appealable', 'NotAppealable')
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
      const subject = action ? subjectFromEventRow(action) : inputSubject!
      if (
        inputSubject &&
        action &&
        subjectKey(inputSubject) !== subjectKey(subject)
      ) {
        throw new ForbiddenError('Target is not appealable', 'NotAppealable')
      }
      if (requester !== subject.did) {
        throw new ForbiddenError('Target is not appealable', 'NotAppealable')
      }

      await ctx.moderationServiceProfile().validateReasonType(REASONAPPEAL)

      await fileAppeal(ctx, {
        requester,
        subject,
        actionId: action?.id,
        reason: input.body.reason,
        modTool: input.body.modTool,
      })

      // The appeal report ID stays internal: callers track the appeal through
      // the subject view. Read after the commit so the view reflects the appeal
      // that was just filed, and treat a missing snapshot as a bug rather than
      // papering over it - the subject provably has moderation history, since
      // the write above just added to it.
      const view = await hydrateSubjectView(
        ctx.db,
        subject,
        ctx.cfg.service.did,
        ctx.cfg.inbox,
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
