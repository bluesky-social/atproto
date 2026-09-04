import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { ForbiddenError } from '@atproto/xrpc-server'
import type { AppContext } from '../context.js'
import type { Database } from '../db/index.js'
import type { DatabaseSchemaType } from '../db/schema/index.js'
import { jsonb } from '../db/types.js'
import type { AppealView } from '../lexicon/types/tools/ozone/inbox/defs.js'
import { REASONAPPEAL as APPEAL_REASON_TYPE } from '../lexicon/types/tools/ozone/report/defs.js'
import type { ModSubject } from '../mod-service/subject.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'
import { findMatchingQueue } from '../queue/service.js'
import { TagService } from '../tag-service/index.js'
import { getTagForReport } from '../tag-service/util.js'

export const TAKEDOWN = 'tools.ozone.moderation.defs#modEventTakedown'
export const REVERSE_TAKEDOWN =
  'tools.ozone.moderation.defs#modEventReverseTakedown'
export const LABEL = 'tools.ozone.moderation.defs#modEventLabel'
export const EMAIL = 'tools.ozone.moderation.defs#modEventEmail'
export const MUTE_REPORTER = 'tools.ozone.moderation.defs#modEventMuteReporter'
export const REVOKE_CREDENTIALS =
  'tools.ozone.moderation.defs#revokeAccountCredentialsEvent'

/**
 * The subject's most recent `reasonAppeal` report, reduced to the columns the
 * appeal state derives from. Deliberately excludes `actionNote` and everything
 * else a moderator wrote for other moderators.
 */
export type AppealReport = {
  id: number
  status: string
  createdAt: string
  closedAt: string | null
}

export type AppealInput = {
  subject: ModSubject
  status: ModerationSubjectStatusRow | null
  report: AppealReport | null
  publicNote: string | null

  /** Calendar months an action stays appealable, from `InboxConfig`. */
  windowMonths: number
  latestAppealableAt: string | null
}

export type AppealState = {
  view: AppealView
  availableActions: string[]
}

export const PUBLIC_EVENT_ACTIONS = [
  TAKEDOWN,
  LABEL,
  EMAIL,
  MUTE_REPORTER,
  REVOKE_CREDENTIALS,
  REVERSE_TAKEDOWN,
] as const

export const APPEALABLE_EVENT_ACTIONS = [TAKEDOWN, LABEL] as const

export const isAppealableEvent = (action: string): boolean =>
  (APPEALABLE_EVENT_ACTIONS as readonly string[]).includes(action)

export const appealWindowEnd = (
  actionCreatedAt: string,
  windowMonths: number,
): string => {
  const end = new Date(actionCreatedAt)
  const day = end.getUTCDate()
  end.setUTCMonth(end.getUTCMonth() + windowMonths)
  // Clamp a rollover: 31 Aug + 6 months is 28/29 Feb, not 2/3 Mar.
  if (end.getUTCDate() !== day) end.setUTCDate(0)
  return end.toISOString()
}

export const isAppealWindowOpen = (
  actionCreatedAt: string,
  windowMonths: number,
  now = new Date(),
): boolean => new Date(appealWindowEnd(actionCreatedAt, windowMonths)) > now

/**
 * Appeal state, derived entirely from data Ozone already records.
 */
export const toAppealState = ({
  subject,
  status,
  report,
  publicNote,
  latestAppealableAt,
  windowMonths,
}: AppealInput): AppealState => {
  const appealableUntil = latestAppealableAt
    ? appealWindowEnd(latestAppealableAt, windowMonths)
    : null
  const windowOpen = !!appealableUntil && new Date(appealableUntil) > new Date()

  let state: AppealView['state']
  if (status?.appealed) {
    state = 'pending'
  } else if (report) {
    // Cleared without the appeal being worked - a takedown or an automatic
    // resolution reset the flag - rather than actually reviewed.
    state = report.closedAt ? 'resolved' : 'superseded'
  } else {
    state = appealableUntil && !windowOpen ? 'expired' : 'none'
  }

  const view: AppealView = { state }
  if (report) {
    view.appealedAt = status?.lastAppealedAt ?? report.createdAt
    if (report.closedAt) view.resolvedAt = report.closedAt
  }
  if (state === 'resolved' && publicNote) view.note = publicNote
  if (appealableUntil) view.appealableUntil = appealableUntil

  const availableActions =
    windowOpen && !appealsExhausted(subject, report) ? ['appeal'] : []

  return { view, availableActions }
}

/**
 * Stable identity of a moderated subject, independent of which action touched
 * it. Two appeals against the same record - or the same message, or the same
 * conversation - share a key even when they name different action IDs.
 */
export const subjectKey = (subject: ModSubject): string => {
  const { subjectDid, subjectMessageId, subjectConvoId } = subject.info()
  if (subject.isMessage()) return `message:${subjectDid}:${subjectMessageId}`
  if (subject.isConvo()) return `convo:${subjectDid}:${subjectConvoId}`
  if (subject.isRecord()) return `record:${subjectDid}:${subject.recordPath}`
  return `account:${subjectDid}`
}

/**
 * Match report rows by that identity. Mirrors the subject normalization in
 * `mod-service/report.ts`: `recordPath` is '' for accounts, messages, and
 * conversations alike, so an account match has to exclude the chat columns.
 */
export const reportSubjectFilter = (
  eb: ExpressionBuilder<DatabaseSchemaType, 'report'>,
  subject: ModSubject,
): Expression<SqlBool> => {
  const { subjectDid, subjectMessageId, subjectConvoId } = subject.info()
  if (subject.isMessage()) {
    return eb.and([
      eb('did', '=', subjectDid),
      eb('subjectMessageId', '=', subjectMessageId),
    ])
  }
  if (subject.isConvo()) {
    return eb.and([
      eb('did', '=', subjectDid),
      eb('subjectConvoId', '=', subjectConvoId),
      eb('subjectMessageId', 'is', null),
    ])
  }
  if (subject.isRecord()) {
    return eb.and([
      eb('did', '=', subjectDid),
      eb('recordPath', '=', subject.recordPath),
    ])
  }
  return eb.and([
    eb('did', '=', subjectDid),
    eb('recordPath', '=', ''),
    eb('subjectMessageId', 'is', null),
    eb('subjectConvoId', 'is', null),
  ])
}

/**
 * Label rows are keyed by a single string: the record URI, or the DID for an
 * account.
 */
export const subjectLabelUri = (subject: ModSubject): string =>
  subject.info().subjectUri ?? subject.did

/**
 * Whether the subject has used up its appeals.
 *
 * Non-account subjects get one ever, closed or not. An account gets one at a
 * time - and an appeal whose report is still open counts even when the
 * `appealed` flag was cleared out from under it, which is what happens when a
 * takedown supersedes an appeal nobody ever worked.
 *
 * The read path calls this to decide whether to offer `appeal`, and the write
 * path calls it to decide whether to accept one. They have to be the same
 * question: anything else advertises an appeal that submission will refuse.
 */
export const appealsExhausted = (
  subject: ModSubject,
  report: AppealReport | null,
): boolean => {
  if (!report) return false
  return subject.isRepo() ? report.status !== 'closed' : true
}

/**
 * Reject an appeal the subject is no longer entitled to.
 *
 * Answers the same question as the `availableActions` the read path
 * advertises, through {@link appealsExhausted}, so the two cannot drift.
 */
export const assertAppealAllowed = async (
  dbTxn: Database,
  subject: ModSubject,
) => {
  dbTxn.assertTransaction()

  const existing = await dbTxn.db
    .selectFrom('report')
    .where('reportType', '=', APPEAL_REASON_TYPE)
    .where((eb) => reportSubjectFilter(eb, subject))
    .orderBy('id', 'desc')
    .select(['id', 'status', 'createdAt', 'closedAt'])
    .executeTakeFirst()

  if (appealsExhausted(subject, existing ?? null)) {
    throw new ForbiddenError(
      subject.isRepo()
        ? 'Awaiting decision on previous appeal'
        : 'This has already been appealed',
      'AlreadyAppealed',
    )
  }
}

export type FileAppealInput = {
  /** DID of the authenticated account filing the appeal. */
  requester: string
  /** The subject being appealed, already resolved and authorized. */
  subject: ModSubject
  /** The action being appealed, when the appeal names one. */
  actionId?: number
  /** Optional: an appeal is a request for review, not an argued case. */
  reason?: string
  modTool?: { name: string; meta?: { [_ in string]: unknown } }
}

/**
 * Pick the queue an appeal should land in.
 *
 * A linked appeal inherits the queue of the report the appealed action
 * resolved, but only when every candidate agrees - bulk and collateral actions
 * can link one event to reports sitting in different queues, and guessing
 * between them is worse than leaving the appeal for the router. An unlinked
 * appeal falls back to whatever queue is configured to accept appeals.
 *
 * This is a read of best-effort routing data, so it deliberately runs outside
 * the appeal transaction: holding the subject lock across a queue listing and
 * a report scan would serialize unrelated appeals for no consistency gain, and
 * if the routing data moves underneath us the router reassigns anyway.
 */
const selectQueue = async (
  ctx: AppContext,
  subject: ModSubject,
  actionId: number | undefined,
) => {
  const sourceReports =
    actionId === undefined
      ? []
      : await ctx.db.db
          .selectFrom('report')
          .where('reportType', '!=', APPEAL_REASON_TYPE)
          .where('actionEventIds', '@>', jsonb([actionId]))
          .select(['queueId', 'queuedAt'])
          .execute()
  const sourceQueues = new Set(
    sourceReports
      .map((source) => source.queueId)
      .filter((queueId): queueId is number => queueId !== null),
  )

  const legacyQueue =
    actionId === undefined
      ? findMatchingQueue(
          (await ctx.queueService(ctx.db).list({ limit: 1000, enabled: true }))
            .queues,
          subject.isRecord() ? 'record' : 'account',
          subject.info().subjectUri
            ? new AtUri(subject.info().subjectUri!).collection
            : null,
          APPEAL_REASON_TYPE,
        )
      : null

  const queueId =
    actionId === undefined
      ? (legacyQueue?.id ?? -1)
      : sourceQueues.size === 1
        ? [...sourceQueues][0]
        : -1

  // An unrouted report carries no queue timestamp: `queuedAt` records when a
  // report entered a queue, and matches the `queueId: -1` / `status: 'open'`
  // shape the queue service uses for everything it cannot route.
  return {
    queueId,
    queuedAt: queueId > 0 ? new Date().toISOString() : null,
  }
}

/**
 * File an appeal: validate the target, route it, and record it.
 *
 * An appeal is an ordinary `reasonAppeal` report, so it inherits the report
 * lifecycle, queue routing, and activity machinery rather than introducing a
 * parallel one. What makes it a *linked* appeal is `actionEventIds`, whose
 * first entry is the action being challenged.
 *
 * Everything that must be atomic - the eligibility guard, the report event,
 * the report row, and the tag - shares one transaction. Everything that need
 * not be, is already done by the time it opens.
 */
export const fileAppeal = async (
  ctx: AppContext,
  { requester, subject, actionId, reason, modTool }: FileAppealInput,
): Promise<{ reportId: number }> => {
  const { queueId, queuedAt } = await selectQueue(ctx, subject, actionId)

  const subjectInfo = subject.info()
  const recordPath = subjectInfo.subjectUri
    ? (() => {
        const uri = new AtUri(subjectInfo.subjectUri)
        return `${uri.collection}/${uri.rkey}`
      })()
    : ''

  const reportId = await ctx.db.transaction(async (dbTxn) => {
    await assertAppealAllowed(dbTxn, subject)

    // create event and report row
    const moderationTxn = ctx.modService(dbTxn)
    const { event: reportEvent, subjectStatus } = await moderationTxn.report({
      reason,
      subject,
      reasonType: APPEAL_REASON_TYPE,
      reportedBy: requester,
      modTool,
    })
    const now = reportEvent.createdAt
    const inserted = await dbTxn.db
      .insertInto('report')
      .values({
        eventId: reportEvent.id,
        queueId,
        queuedAt,
        actionEventIds: actionId === undefined ? null : jsonb([actionId]),
        actionNote: null,
        isMuted:
          !!reportEvent.meta?.isReporterMuted ||
          !!reportEvent.meta?.isSubjectMuted,
        isAutomated: modTool?.meta?.isAutomated === true,
        status: queueId > 0 ? 'queued' : 'open',
        reportType: APPEAL_REASON_TYPE,
        did: subjectInfo.subjectDid,
        recordPath,
        subjectMessageId: subjectInfo.subjectMessageId,
        subjectConvoId: subjectInfo.subjectConvoId,
        createdAt: now,
        updatedAt: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    // apply appeal tag
    const tagService = new TagService(
      subject,
      subjectStatus,
      ctx.cfg.service.did,
      moderationTxn,
    )
    await tagService.evaluateForSubject([getTagForReport(APPEAL_REASON_TYPE)])

    return inserted.id
  })

  return { reportId }
}
