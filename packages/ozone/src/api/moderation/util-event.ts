import {
  $Typed,
  ComAtprotoAdminDefs,
  ComAtprotoRepoStrongRef,
  ToolsOzoneModerationDefs,
} from '@atproto/api'
import { isModEventDivert } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier'
import { AppContext } from '../../context'
import { ids } from '../../lexicon/lexicons'
import {
  ModEventTag,
  isAgeAssuranceEvent,
  isAgeAssuranceOverrideEvent,
  isModEventAcknowledge,
  isModEventEmail,
  isModEventLabel,
  isModEventMuteReporter,
  isModEventReport,
  isModEventReverseTakedown,
  isModEventTag,
  isModEventTakedown,
  isModEventUnmuteReporter,
  isRevokeAccountCredentialsEvent,
} from '../../lexicon/types/tools/ozone/moderation/defs'
import { httpLogger } from '../../logger'
import { ModSubject, subjectFromInput } from '../../mod-service/subject'
import { SettingService } from '../../setting/service'
import { TagService } from '../../tag-service'
import { getTagForReport } from '../../tag-service/util'
import { retryHttp } from '../../util'
import { getEventType } from '../util'
import { assertProtectedTagAction, getProtectedTags } from './util'

type ModerationEvent = InputSchema['event']

/**
 * Validates that the authenticated user is allowed to emit this event type.
 */
export const validateEventAuth = async ({
  ctx,
  auth,
  event,
}: {
  ctx: AppContext
  auth: ModeratorOutput | AdminTokenOutput
  event: ModerationEvent
}): Promise<void> => {
  const access = auth.credentials
  const isTakedownEvent = isModEventTakedown(event)
  const isReverseTakedownEvent = isModEventReverseTakedown(event)
  const isLabelEvent = isModEventLabel(event)
}

/**
 * Validates that the subject type is compatible with the event type.
 */
export const validateSubjectForEvent = ({
  event,
  subject,
  auth,
}: {
  event: ModerationEvent
  subject: ModSubject
  auth: ModeratorOutput | AdminTokenOutput
}): void => {
  const access = auth.credentials
  const isAcknowledgeEvent = isModEventAcknowledge(event)
  const isTakedownEvent = isModEventTakedown(event)
  const isReverseTakedownEvent = isModEventReverseTakedown(event)
  const isLabelEvent = isModEventLabel(event)

  if (isAgeAssuranceEvent(event) && !subject.isRepo()) {
    throw new InvalidRequestError('Invalid subject type')
  }

  if (isAgeAssuranceOverrideEvent(event)) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Invalid subject type')
    }
    if (!auth.credentials.isModerator) {
      throw new AuthRequiredError(
        'Must be a full moderator to override age assurance',
      )
    }
  }

  if (isRevokeAccountCredentialsEvent(event)) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('Invalid subject type')
    }

    if (!auth.credentials.isAdmin) {
      throw new AuthRequiredError(
        'Must be an admin to revoke account credentials',
      )
    }
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
      subject.recordPath?.includes('app.bsky.feed.generator/')
    ) {
      throw new AuthRequiredError(
        'Must be a full admin to take this type of action on feed generators',
      )
    }
  }
}

export interface InputSchema {
  event:
    | $Typed<ToolsOzoneModerationDefs.ModEventTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventAcknowledge>
    | $Typed<ToolsOzoneModerationDefs.ModEventEscalate>
    | $Typed<ToolsOzoneModerationDefs.ModEventComment>
    | $Typed<ToolsOzoneModerationDefs.ModEventLabel>
    | $Typed<ToolsOzoneModerationDefs.ModEventReport>
    | $Typed<ToolsOzoneModerationDefs.ModEventMute>
    | $Typed<ToolsOzoneModerationDefs.ModEventUnmute>
    | $Typed<ToolsOzoneModerationDefs.ModEventMuteReporter>
    | $Typed<ToolsOzoneModerationDefs.ModEventUnmuteReporter>
    | $Typed<ToolsOzoneModerationDefs.ModEventReverseTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventResolveAppeal>
    | $Typed<ToolsOzoneModerationDefs.ModEventEmail>
    | $Typed<ToolsOzoneModerationDefs.ModEventDivert>
    | $Typed<ToolsOzoneModerationDefs.ModEventTag>
    | $Typed<ToolsOzoneModerationDefs.AccountEvent>
    | $Typed<ToolsOzoneModerationDefs.IdentityEvent>
    | $Typed<ToolsOzoneModerationDefs.RecordEvent>
    | $Typed<ToolsOzoneModerationDefs.ModEventPriorityScore>
    | $Typed<ToolsOzoneModerationDefs.AgeAssuranceEvent>
    | $Typed<ToolsOzoneModerationDefs.AgeAssuranceOverrideEvent>
    | $Typed<ToolsOzoneModerationDefs.RevokeAccountCredentialsEvent>
    | $Typed<ToolsOzoneModerationDefs.ScheduleTakedownEvent>
    | $Typed<ToolsOzoneModerationDefs.CancelScheduledTakedownEvent>
    | { $type: string }
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  subjectBlobCids?: string[]
  createdBy: string
  modTool?: ToolsOzoneModerationDefs.ModTool
  externalId?: string
}

export const handleModerationEvent = async ({
  ctx,
  input,
  auth,
}: {
  ctx: AppContext
  input: InputSchema
  auth: ModeratorOutput | AdminTokenOutput
}) => {
  const access = auth.credentials
  const createdBy =
    auth.credentials.type === 'moderator'
      ? auth.credentials.iss
      : input.createdBy
  const db = ctx.db
  const moderationService = ctx.modService(db)
  const settingService = ctx.settingService(db)
  const { event, externalId } = input
  const isAcknowledgeEvent = isModEventAcknowledge(event)
  const isTakedownEvent = isModEventTakedown(event)
  const isReverseTakedownEvent = isModEventReverseTakedown(event)
  const isLabelEvent = isModEventLabel(event)
  const subject = subjectFromInput(input.subject, input.subjectBlobCids)

  if (isRevokeAccountCredentialsEvent(event)) {
    if (!ctx.pdsAgent) {
      throw new InvalidRequestError('PDS not configured')
    }

    await ctx.pdsAgent.com.atproto.temp.revokeAccountCredentials(
      { account: subject.did },
      await ctx.pdsAuth(ids.ComAtprotoTempRevokeAccountCredentials),
    )
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

  if (isModEventEmail(event) && event.content) {
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

  if (isModEventDivert(event) && subject.isRecord()) {
    if (!ctx.blobDiverter) {
      throw new InvalidRequestError(
        'BlobDiverter not configured for this service',
      )
    }
    await ctx.blobDiverter.uploadBlobOnService(subject.info())
  }

  if (
    (isModEventMuteReporter(event) || isModEventUnmuteReporter(event)) &&
    !subject.isRepo()
  ) {
    throw new InvalidRequestError('Subject must be a repo when muting reporter')
  }

  if (isModEventTag(event)) {
    await assertTagAuth(settingService, ctx.cfg.service.did, event, auth)
  }

  if (isModEventReport(event)) {
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

    const result = await moderationTxn.logEvent({
      event,
      subject,
      createdBy,
      modTool: input.modTool,
      externalId,
    })

    const tagService = new TagService(
      subject,
      result.subjectStatus,
      ctx.cfg.service.did,
      moderationTxn,
    )

    const initialTags = isModEventReport(event)
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

const assertTagAuth = async (
  settingService: SettingService,
  serviceDid: string,
  event: ModEventTag,
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
          !configuredRoles.includes('tools.ozone.team.defs#roleModerator')
        ) {
          throw new InvalidRequestError(
            `Can not manage tag ${tag} with moderator role`,
          )
        } else if (
          auth.credentials.isTriage &&
          !configuredRoles.includes('tools.ozone.team.defs#roleTriage')
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
