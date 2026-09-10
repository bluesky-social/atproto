import type { DidString } from '@atproto/lex'
import {
  AuthRequiredError,
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier.js'
import type { AppContext } from '../../context.js'
import { app, com, tools } from '../../lexicons/index.js'
import { httpLogger } from '../../logger.js'
import { processReportAction } from '../../mod-service/report.js'
import { subjectFromInput } from '../../mod-service/subject.js'
import type { SettingService } from '../../setting/service.js'
import { TagService } from '../../tag-service/index.js'
import { getTagForReport } from '../../tag-service/util.js'
import { retryHttp } from '../../util.js'
import { getEventType } from '../util.js'
import { assertProtectedTagAction, getProtectedTags } from './util.js'

const handleModerationEvent = async ({
  ctx,
  input,
  auth,
}: {
  ctx: AppContext
  input: { body: tools.ozone.moderation.emitEvent.$InputBody }
  auth: ModeratorOutput | AdminTokenOutput
}) => {
  const access = auth.credentials
  const createdBy =
    auth.credentials.type === 'moderator'
      ? auth.credentials.iss
      : input.body.createdBy
  const db = ctx.db
  const moderationService = ctx.modService(db)
  const settingService = ctx.settingService(db)
  const { event, externalId } = input.body
  const isAcknowledgeEvent =
    tools.ozone.moderation.defs.modEventAcknowledge.$isTypeOf(event)
  const isTakedownEvent =
    tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event)
  const isReverseTakedownEvent =
    tools.ozone.moderation.defs.modEventReverseTakedown.$isTypeOf(event)
  const isLabelEvent =
    tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event)
  const subject = subjectFromInput(
    input.body.subject,
    input.body.subjectBlobCids,
  )

  if (
    tools.ozone.moderation.defs.ageAssuranceEvent.$isTypeOf(event) &&
    !subject.isRepo()
  ) {
    throw new InvalidRequestError('Invalid subject type')
  }

  if (tools.ozone.moderation.defs.ageAssuranceOverrideEvent.$isTypeOf(event)) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Invalid subject type')
    }
    if (!auth.credentials.isModerator) {
      throw new AuthRequiredError(
        'Must be a full moderator to override age assurance',
      )
    }
  }

  if (tools.ozone.moderation.defs.ageAssurancePurgeEvent.$isTypeOf(event)) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Invalid subject type')
    }
    if (!auth.credentials.isModerator) {
      throw new ForbiddenError(
        'Must be a moderator to purge age assurance events',
      )
    }
  }

  if (
    tools.ozone.moderation.defs.revokeAccountCredentialsEvent.$isTypeOf(event)
  ) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Invalid subject type')
    }

    if (!auth.credentials.isAdmin) {
      throw new AuthRequiredError(
        'Must be an admin to revoke account credentials',
      )
    }

    if (!ctx.pdsClient) {
      throw new InvalidRequestError('PDS not configured')
    }

    await ctx.pdsClient.call(
      com.atproto.temp.revokeAccountCredentials,
      { account: subject.did },
      await ctx.pdsAuth(com.atproto.temp.revokeAccountCredentials.$lxm),
    )
  }

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
      subject.recordPath?.includes(`/${app.bsky.feed.generator.$type}/`)
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

  const isTakedownOrReverseTakedownEvent =
    isTakedownEvent || isReverseTakedownEvent
  if (isTakedownOrReverseTakedownEvent || isLabelEvent) {
    const status = await moderationService.getStatus(subject)

    if (status?.takendown && isTakedownEvent) {
      throw new InvalidRequestError(`Subject is already taken down`)
    }

    if (!status?.takendown && isReverseTakedownEvent) {
      throw new InvalidRequestError(`Subject is not taken down`)
    }

    if (status?.tags?.length) {
      const protectedTags = await getProtectedTags(
        settingService,
        ctx.cfg.service.did,
      )

      if (protectedTags) {
        assertProtectedTagAction({
          protectedTags,
          subjectTags: status.tags,
          actionAuthor: createdBy,
          isAdmin: auth.credentials.isAdmin,
          isModerator: auth.credentials.isModerator,
          isTriage: auth.credentials.isTriage,
        })
      }
    }

    if (status?.takendown && isReverseTakedownEvent && subject.isRecord()) {
      // due to the way blob status is modeled, we should reverse takedown on all
      // blobs for the record being restored, which aren't taken down on another record.
      subject.blobCids = status.blobCids ?? []
    }
  }

  if (
    tools.ozone.moderation.defs.modEventEmail.$isTypeOf(event) &&
    event.content
  ) {
    // sending email prior to logging the event to avoid a long transaction below
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Email can only be sent to a repo subject')
    }
    const { content, subjectLine } = event
    // on error, don't fail the whole event. instead, log the event data with isDelivered false
    try {
      await retryHttp(() =>
        ctx.modService(db).sendEmail({
          subject: subjectLine,
          content,
          recipientDid: subject.did,
        }),
      )
      event.isDelivered = true
    } catch (err) {
      event.isDelivered = false
      httpLogger.error({ err, event }, 'failed to send mod event email')
    }
  }

  if (
    tools.ozone.moderation.defs.modEventDivert.$isTypeOf(event) &&
    subject.isRecord()
  ) {
    if (!ctx.blobDiverter) {
      throw new InvalidRequestError(
        'BlobDiverter not configured for this service',
      )
    }
    await ctx.blobDiverter.uploadBlobOnService(subject.info())
  }

  if (
    (tools.ozone.moderation.defs.modEventMuteReporter.$isTypeOf(event) ||
      tools.ozone.moderation.defs.modEventUnmuteReporter.$isTypeOf(event)) &&
    !subject.isRepo()
  ) {
    throw new InvalidRequestError('Subject must be a repo when muting reporter')
  }

  if (tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)) {
    await assertTagAuth(settingService, ctx.cfg.service.did, event, auth)
  }

  if (tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)) {
    await ctx.moderationServiceProfile().validateReasonType(event.reportType)
  }

  const moderationEvent = await db.transaction(async (dbTxn) => {
    const moderationTxn = ctx.modService(dbTxn)

    if (externalId) {
      const existingEvent = await moderationTxn.getEventByExternalId(
        getEventType(event.$type),
        externalId,
        subject,
      )

      if (existingEvent) {
        throw new InvalidRequestError(
          `An event with the same external ID already exists for the subject.`,
          'DuplicateExternalId',
        )
      }
    }

    // Validate reportAction if provided (actual processing happens after event is logged)
    if (input.body.reportAction) {
      // Validate that at least one targeting criteria is provided
      const { reportAction } = input.body
      if (
        !reportAction.ids?.length &&
        !reportAction.types?.length &&
        !reportAction.all
      ) {
        throw new InvalidRequestError(
          'reportAction must specify ids, types, or all',
        )
      }
    }

    const result = await moderationTxn.logEvent({
      event,
      subject,
      createdBy,
      modTool: input.body.modTool,
      externalId,
    })

    // Update reports if reportAction was provided
    if (input.body.reportAction) {
      const subjectUri = subject.isRecord() ? subject.uri : null
      try {
        await processReportAction({
          db: dbTxn,
          reportAction: input.body.reportAction,
          subjectDid: subject.did,
          subjectUri,
          eventId: result.event.id,
          eventType: event.$type,
          createdBy,
        })
      } catch (err) {
        throw new InvalidRequestError(
          err instanceof Error
            ? err.message
            : 'Failed to process report action',
        )
      }
    }

    const tagService = new TagService(
      subject,
      result.subjectStatus,
      ctx.cfg.service.did,
      moderationTxn,
    )

    const initialTags = tools.ozone.moderation.defs.modEventReport.$isTypeOf(
      event,
    )
      ? [getTagForReport(event.reportType)]
      : undefined
    await tagService.evaluateForSubject(initialTags)

    if (subject.isRepo()) {
      if (isTakedownEvent) {
        const isSuspend = !!result.event.durationInHours
        await moderationTxn.takedownRepo(
          subject,
          result.event.id,
          new Set(
            result.event.meta?.targetServices
              ? `${result.event.meta.targetServices}`.split(',')
              : undefined,
          ),
          isSuspend,
        )
      } else if (isReverseTakedownEvent) {
        await moderationTxn.reverseTakedownRepo(subject)
      }
    }

    if (subject.isRecord()) {
      if (isTakedownEvent) {
        await moderationTxn.takedownRecord(
          subject,
          result.event.id,
          new Set(
            result.event.meta?.targetServices
              ? `${result.event.meta.targetServices}`.split(',')
              : undefined,
          ),
        )
      } else if (isReverseTakedownEvent) {
        await moderationTxn.reverseTakedownRecord(subject)
      }
    }

    if (
      (isTakedownEvent || isAcknowledgeEvent) &&
      result.event.meta?.acknowledgeAccountSubjects
    ) {
      await moderationTxn.resolveSubjectsForAccount(
        subject.did,
        createdBy,
        result.event,
      )
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
        result.event.durationInHours ?? undefined,
      )
    }

    return result.event
  })

  return moderationService.views.formatEvent(moderationEvent)
}

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.emitEvent, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      try {
        const moderationEvent = await handleModerationEvent({
          input,
          auth,
          ctx,
        })

        // On divert events, we need to automatically take down the blobs
        if (
          tools.ozone.moderation.defs.modEventDivert.$isTypeOf(input.body.event)
        ) {
          await handleModerationEvent({
            auth,
            ctx,
            input: {
              ...input,
              body: {
                ...input.body,
                event: tools.ozone.moderation.defs.modEventTakedown.$build({
                  ...input.body.event,
                  comment:
                    '[DIVERT_SIDE_EFFECT]: Automatically taking down after divert event',
                }),
                modTool: input.body.modTool,
              },
            },
          })
        }

        return {
          encoding: 'application/json',
          body: moderationEvent,
        }
      } catch (err) {
        httpLogger.error(
          { err, body: input.body },
          'failed to emit moderation event',
        )
        throw err
      }
    },
  })
}

const assertTagAuth = async (
  settingService: SettingService,
  serviceDid: DidString,
  event: tools.ozone.moderation.defs.ModEventTag,
  auth: ModeratorOutput | AdminTokenOutput,
) => {
  // admins can add/remove any tag
  if (auth.credentials.isAdmin) return

  const protectedTags = await getProtectedTags(settingService, serviceDid)

  if (!protectedTags) {
    return
  }

  for (const tag of Object.keys(protectedTags)) {
    if (event.add.includes(tag) || event.remove.includes(tag)) {
      // if specific moderators are configured to manage this tag but the current user
      // is not one of them, then throw an error
      const configuredModerators = protectedTags[tag]?.['moderators']
      if (
        configuredModerators &&
        !configuredModerators.includes(auth.credentials.iss)
      ) {
        throw new InvalidRequestError(`Not allowed to manage tag: ${tag}`)
      }

      const configuredRoles = protectedTags[tag]?.['roles']
      if (configuredRoles) {
        // admins can already do everything so we only check for moderator and triage role config
        if (
          auth.credentials.isModerator &&
          !configuredRoles.includes(tools.ozone.team.defs.RoleModerator)
        ) {
          throw new InvalidRequestError(
            `Can not manage tag ${tag} with moderator role`,
          )
        } else if (
          auth.credentials.isTriage &&
          !configuredRoles.includes(tools.ozone.team.defs.RoleTriage)
        ) {
          throw new InvalidRequestError(
            `Can not manage tag ${tag} with triage role`,
          )
        }
      }
    }
  }
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
