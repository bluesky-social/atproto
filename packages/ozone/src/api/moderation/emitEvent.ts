import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import {
  isModEventDivert,
  isModEventEmail,
  isModEventLabel,
  isModEventReverseTakedown,
  isModEventTakedown,
} from '../../lexicon/types/tools/ozone/moderation/defs'
import { HandlerInput } from '../../lexicon/types/tools/ozone/moderation/emitEvent'
import { subjectFromInput } from '../../mod-service/subject'
import { ModerationLangService } from '../../mod-service/lang'
import { retryHttp } from '../../util'
import { ModeratorOutput, AdminTokenOutput } from '../../auth-verifier'

const handleModerationEvent = async ({
  ctx,
  input,
  auth,
}: {
  ctx: AppContext
  input: HandlerInput
  auth: ModeratorOutput | AdminTokenOutput
}) => {
  const access = auth.credentials
  const createdBy =
    auth.credentials.type === 'moderator'
      ? auth.credentials.iss
      : input.body.createdBy
  const db = ctx.db
  const moderationService = ctx.modService(db)
  const { event } = input.body
  const isTakedownEvent = isModEventTakedown(event)
  const isReverseTakedownEvent = isModEventReverseTakedown(event)
  const isLabelEvent = isModEventLabel(event)
  const subject = subjectFromInput(
    input.body.subject,
    input.body.subjectBlobCids,
  )

  // apply access rules

  // if less than moderator access then can only take ack and escalation actions
  if (isTakedownEvent || isReverseTakedownEvent) {
    if (!access.isModerator) {
      throw new AuthRequiredError(
        'Must be a full moderator to take this type of action',
      )
    }

    // Non admins should not be able to take down feed generators
    if (
      !access.isAdmin &&
      subject.recordPath?.includes('app.bsky.feed.generator/')
    ) {
      throw new AuthRequiredError(
        'Must be a full admin to take this type of action on feed generators',
      )
    }
  }
  // if less than moderator access then can not apply labels
  if (!access.isModerator && isLabelEvent) {
    throw new AuthRequiredError('Must be a full moderator to label content')
  }

  if (isLabelEvent) {
    validateLabels([
      ...(event.createLabelVals ?? []),
      ...(event.negateLabelVals ?? []),
    ])
  }

  if (isTakedownEvent || isReverseTakedownEvent) {
    const status = await moderationService.getStatus(subject)

    if (status?.takendown && isTakedownEvent) {
      throw new InvalidRequestError(`Subject is already taken down`)
    }

    if (!status?.takendown && isReverseTakedownEvent) {
      throw new InvalidRequestError(`Subject is not taken down`)
    }

    if (status?.takendown && isReverseTakedownEvent && subject.isRecord()) {
      // due to the way blob status is modeled, we should reverse takedown on all
      // blobs for the record being restored, which aren't taken down on another record.
      subject.blobCids = status.blobCids ?? []
    }
  }

  if (isModEventEmail(event) && event.content) {
    // sending email prior to logging the event to avoid a long transaction below
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Email can only be sent to a repo subject')
    }
    const { content, subjectLine } = event
    await retryHttp(() =>
      ctx.modService(db).sendEmail({
        subject: subjectLine,
        content,
        recipientDid: subject.did,
      }),
    )
  }

  if (isModEventDivert(event) && subject.isRecord()) {
    if (!ctx.blobDiverter) {
      throw new InvalidRequestError(
        'BlobDiverter not configured for this service',
      )
    }
    await ctx.blobDiverter.uploadBlobOnService(subject.info())
  }

  const moderationEvent = await db.transaction(async (dbTxn) => {
    const moderationTxn = ctx.modService(dbTxn)

    const result = await moderationTxn.logEvent({
      event,
      subject,
      createdBy,
    })

    const moderationLangService = new ModerationLangService(moderationTxn)
    await moderationLangService.tagSubjectWithLang({
      subject,
      createdBy: ctx.cfg.service.did,
      subjectStatus: result.subjectStatus,
    })

    if (subject.isRepo()) {
      if (isTakedownEvent) {
        const isSuspend = !!result.event.durationInHours
        await moderationTxn.takedownRepo(subject, result.event.id, isSuspend)
      } else if (isReverseTakedownEvent) {
        await moderationTxn.reverseTakedownRepo(subject)
      }
    }

    if (subject.isRecord()) {
      if (isTakedownEvent) {
        await moderationTxn.takedownRecord(subject, result.event.id)
      } else if (isReverseTakedownEvent) {
        await moderationTxn.reverseTakedownRecord(subject)
      }
    }

    if (isLabelEvent) {
      await moderationTxn.formatAndCreateLabels(
        result.event.subjectUri ?? result.event.subjectDid,
        result.event.subjectCid,
        {
          create: result.event.createLabelVals?.length
            ? result.event.createLabelVals.split(' ')
            : undefined,
          negate: result.event.negateLabelVals?.length
            ? result.event.negateLabelVals.split(' ')
            : undefined,
        },
      )
    }

    return result.event
  })

  return moderationService.views.formatEvent(moderationEvent)
}

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.emitEvent({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const moderationEvent = await handleModerationEvent({
        input,
        auth,
        ctx,
      })

      // On divert events, we need to automatically take down the blobs
      if (isModEventDivert(input.body.event)) {
        await handleModerationEvent({
          auth,
          ctx,
          input: {
            ...input,
            body: {
              ...input.body,
              event: {
                ...input.body.event,
                $type: 'tools.ozone.moderation.defs#modEventTakedown',
                comment:
                  '[DIVERT_SIDE_EFFECT]: Automatically taking down after divert event',
              },
            },
          },
        })
      }

      return {
        encoding: 'application/json',
        body: moderationEvent,
      }
    },
  })
}

const validateLabels = (labels: string[]) => {
  for (const label of labels) {
    for (const char of badChars) {
      if (label.includes(char)) {
        throw new InvalidRequestError(`Invalid label: ${label}`)
      }
    }
  }
}

const badChars = [' ', ',', ';', `'`, `"`]
