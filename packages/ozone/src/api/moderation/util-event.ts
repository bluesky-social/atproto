import type { DidString } from '@atproto/lex-schema'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import type { AdminTokenOutput, ModeratorOutput } from '../../auth-verifier.js'
import type { AppContext } from '../../context.js'
import { app, com, tools } from '../../lexicons/index.js'
import { httpLogger } from '../../logger.js'
import { processReportAction } from '../../mod-service/report.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
  subjectFromInput,
} from '../../mod-service/subject.js'
import { handleReportUpdate } from '../../report/handle-report-update.js'
import { getEventActivityMetadata } from '../../report/metadata.js'
import type { SettingService } from '../../setting/service.js'
import { TagService } from '../../tag-service/index.js'
import { getTagForReport } from '../../tag-service/util.js'
import { retryHttp } from '../../util.js'
import { getEventType } from '../util.js'
import { assertProtectedTagAction, getProtectedTags } from './util.js'

/** Apply one bulk entry, committing its event and report updates together. */
export async function handleModerationEvent({
  ctx,
  input,
  auth,
}: {
  ctx: AppContext
  input: tools.ozone.moderation.emitEvents.SubjectEntry &
    Pick<
      tools.ozone.moderation.emitEvents.$InputBody,
      'event' | 'createdBy' | 'modTool'
    >
  auth: ModeratorOutput | AdminTokenOutput
}): Promise<tools.ozone.moderation.defs.ModEventView> {
  const access = auth.credentials
  const createdBy =
    auth.credentials.type === 'moderator'
      ? auth.credentials.iss
      : input.createdBy
  const db = ctx.db
  const moderationService = ctx.modService(db)
  const settingService = ctx.settingService(db)
  const { event, externalId } = input
  const isAcknowledgeEvent =
    tools.ozone.moderation.defs.modEventAcknowledge.$isTypeOf(event)
  const isTakedownEvent =
    tools.ozone.moderation.defs.modEventTakedown.$isTypeOf(event)
  const isReverseTakedownEvent =
    tools.ozone.moderation.defs.modEventReverseTakedown.$isTypeOf(event)
  const isLabelEvent =
    tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event)
  const subject = subjectFromInput(input.subject, input.subjectBlobCids)

  if (subject.isMessage() && (isTakedownEvent || isReverseTakedownEvent)) {
    throw new InvalidRequestError(
      'Message takedowns are not supported; apply the action to the account instead',
    )
  }
  if (subject.isMessage() && isLabelEvent) {
    throw new InvalidRequestError(
      'Message labels are not supported; apply labels to the account instead',
    )
  }

  if (input.reportAction) {
    const { reportAction } = input
    if (
      !reportAction.ids?.length &&
      !reportAction.types?.length &&
      !reportAction.all &&
      !reportAction.allOwned
    ) {
      throw new InvalidRequestError(
        'reportAction must specify ids, types, all, or allOwned',
      )
    }
  }

  if (
    input.reportAction?.subjects !== undefined &&
    input.reportAction?.subjectTypes !== undefined
  ) {
    throw new InvalidRequestError(
      'reportAction subjects and subjectTypes are mutually exclusive',
    )
  }

  if (input.reportAction?.allOwned) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError('allOwned requires an account subject')
    }
    if (
      handleReportUpdate('open', { type: 'event', eventType: event.$type })
        .nextStatus !== 'closed'
    ) {
      throw new InvalidRequestError(
        'allOwned requires an event that closes reports',
      )
    }
  }

  const reportSubjects = input.reportAction?.allOwned
    ? undefined
    : input.reportAction?.subjects?.map((target) => subjectFromInput(target))
  const reportSubjectTypes = input.reportAction?.allOwned
    ? undefined
    : input.reportAction?.subjectTypes
  if (reportSubjects?.some((target) => target.did !== subject.did)) {
    throw new InvalidRequestError(
      'report subjects must belong to the actioned account',
    )
  }
  const subjectInfo = subject.info()
  const expandsReports = reportSubjects?.some((target) => {
    const targetInfo = target.info()
    return (
      targetInfo.subjectType !== subjectInfo.subjectType ||
      targetInfo.subjectUri !== subjectInfo.subjectUri ||
      targetInfo.subjectMessageId !== subjectInfo.subjectMessageId ||
      targetInfo.subjectConvoId !== subjectInfo.subjectConvoId
    )
  })
  const expandsReportTypes = reportSubjectTypes?.some(
    (type) => !subject.isRepo() || type !== 'account',
  )
  if (expandsReports || expandsReportTypes) {
    if (!subject.isRepo()) {
      throw new InvalidRequestError(
        'additional report subjects require an account event',
      )
    }
    if (
      handleReportUpdate('open', { type: 'event', eventType: event.$type })
        .nextStatus !== 'closed'
    ) {
      throw new InvalidRequestError(
        'additional report subjects require an event that closes reports',
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
      throw new InvalidRequestError(
        'PDS not configured',
        'InvalidConfiguration',
      )
    }

    await ctx.pdsClient.call(
      com.atproto.temp.revokeAccountCredentials,
      { account: subject.did },
      await ctx.pdsAuth(com.atproto.temp.revokeAccountCredentials.$lxm),
    )
  }

  if (isTakedownEvent || isReverseTakedownEvent) {
    if (!access.isModerator) {
      throw new AuthRequiredError(
        'Must be a full moderator to take this type of action',
      )
    }

    if (
      !access.isAdmin &&
      subject.recordPath?.startsWith(`${app.bsky.feed.generator.$type}/`)
    ) {
      throw new AuthRequiredError(
        'Must be a full admin to take this type of action on feed generators',
      )
    }
  }
  const isTakedownOrReverseTakedownEvent =
    isTakedownEvent || isReverseTakedownEvent
  if (isTakedownOrReverseTakedownEvent || isLabelEvent) {
    const status = await moderationService.getStatus(subject)

    if (status?.takendown && isTakedownEvent) {
      throw new InvalidRequestError(
        'Subject is already taken down',
        'AlreadyTakendown',
      )
    }

    if (!status?.takendown && isReverseTakedownEvent) {
      throw new InvalidRequestError('Subject is not taken down', 'NotTakendown')
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

    const metadata = input.reportAction
      ? getEventActivityMetadata(input.modTool)
      : undefined

    const result = await moderationTxn.logEvent({
      event,
      subject,
      createdBy,
      modTool: input.modTool,
      externalId,
    })

    if (input.reportAction) {
      const subjectUri = subject.isRecord()
        ? subject.uri
        : subject.isMessage()
          ? `at://${subject.did}/${CHAT_MESSAGE_COLLECTION}/${subject.messageId}`
          : subject.isConvo()
            ? `at://${subject.did}/${CHAT_CONVO_COLLECTION}/${subject.convoId}`
            : null
      try {
        await processReportAction({
          inboxStartAt: ctx.cfg.inbox.startAt,
          db: dbTxn,
          reportAction: input.reportAction,
          subjects: reportSubjects,
          metadata,
          subjectDid: subject.did,
          subjectUri,
          messageConvoId: subject.isMessage() ? subject.convoId : undefined,
          subjectType: subject.info().subjectType,
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

    const initialTags =
      !ctx.cfg.service.reportTagsDisabled &&
      tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)
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
      if (subject.isRepo()) {
        await processReportAction({
          db: dbTxn,
          inboxStartAt: ctx.cfg.inbox.startAt,
          subjectDid: subject.did,
          subjectUri: null,
          subjectType: com.atproto.admin.defs.repoRef.$type,
          eventId: result.event.id,
          eventType: event.$type,
          createdBy,
          reportAction: {
            allOwned: true,
            isAutomated: input.reportAction?.isAutomated,
          },
          metadata: getEventActivityMetadata(input.modTool),
        })
      }
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
  serviceDid: DidString,
  event: tools.ozone.moderation.defs.ModEventTag,
  auth: ModeratorOutput | AdminTokenOutput,
) => {
  if (auth.credentials.isAdmin) return

  const protectedTags = await getProtectedTags(settingService, serviceDid)

  if (!protectedTags) {
    return
  }

  for (const tag of Object.keys(protectedTags)) {
    if (event.add.includes(tag) || event.remove.includes(tag)) {
      const configuredModerators = protectedTags[tag]?.['moderators']
      if (
        configuredModerators &&
        !configuredModerators.includes(auth.credentials.iss)
      ) {
        throw new InvalidRequestError(`Not allowed to manage tag: ${tag}`)
      }

      const configuredRoles = protectedTags[tag]?.['roles']
      if (configuredRoles) {
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
        throw new InvalidRequestError(`Invalid label: ${label}`, 'InvalidLabel')
      }
    }
  }
}

const badChars = [' ', ',', ';', `'`, `"`]

/** Validate request-wide permissions and event data before starting any actions. */
export async function validateEventAuth({
  ctx,
  auth,
  event,
}: {
  ctx: AppContext
  auth: ModeratorOutput | AdminTokenOutput
  event: tools.ozone.moderation.emitEvents.$InputBody['event']
}): Promise<void> {
  const supportedEvents = [
    tools.ozone.moderation.defs.modEventTakedown,
    tools.ozone.moderation.defs.modEventAcknowledge,
    tools.ozone.moderation.defs.modEventLabel,
    tools.ozone.moderation.defs.modEventReport,
    tools.ozone.moderation.defs.modEventReverseTakedown,
    tools.ozone.moderation.defs.modEventResolveAppeal,
    tools.ozone.moderation.defs.modEventEmail,
    tools.ozone.moderation.defs.modEventTag,
    tools.ozone.moderation.defs.revokeAccountCredentialsEvent,
  ]
  // @NOTE Lexicon unions are open, so the route must enforce its supported subset.
  if (!supportedEvents.some((schema) => schema.$type === event.$type)) {
    throw new InvalidRequestError(
      'Unsupported bulk event type',
      'UnsupportedEvent',
    )
  }
  const access = auth.credentials
  const settingService = ctx.settingService(ctx.db)
  const isLabelEvent =
    tools.ozone.moderation.defs.modEventLabel.$isTypeOf(event)
  if (!access.isModerator && isLabelEvent) {
    throw new AuthRequiredError('Must be a full moderator to label content')
  }

  if (isLabelEvent) {
    validateLabels([
      ...(event.createLabelVals ?? []),
      ...(event.negateLabelVals ?? []),
    ])
  }

  if (tools.ozone.moderation.defs.modEventTag.$isTypeOf(event)) {
    await assertTagAuth(settingService, ctx.cfg.service.did, event, auth)
  }

  if (tools.ozone.moderation.defs.modEventReport.$isTypeOf(event)) {
    await ctx
      .moderationServiceProfile()
      .validateReasonType(
        event.reportType,
        tools.ozone.moderation.emitEvents.$lxm,
      )
  }
}

/** Reject duplicate action targets before any work, retaining per-entry failures. */
export function validateSubjects(
  subjects: tools.ozone.moderation.emitEvents.SubjectEntry[],
): void {
  if (subjects.length === 0) {
    throw new InvalidRequestError(
      'Subjects array must not be empty',
      'EmptySubjects',
    )
  }
  const seen = new Set<string>()
  for (const entry of subjects) {
    let key: string
    try {
      const info = subjectFromInput(entry.subject).info()
      key = JSON.stringify([
        info.subjectType,
        info.subjectDid,
        info.subjectUri,
        info.subjectConvoId,
        info.subjectMessageId,
      ])
    } catch (err) {
      if (!(err instanceof InvalidRequestError)) throw err
      // @NOTE Invalid subjects are reported per entry by the handler.
      continue
    }
    if (seen.has(key)) {
      throw new InvalidRequestError(
        'Subjects array contains duplicates',
        'DuplicateSubjects',
      )
    }
    seen.add(key)
  }
}
