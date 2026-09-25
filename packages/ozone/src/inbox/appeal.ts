import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  type UriString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { ForbiddenError, InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../context.js'
import type { Database } from '../db/index.js'
import type { DatabaseSchemaType } from '../db/schema/index.js'
import { jsonb } from '../db/types.js'
import { tools } from '../lexicons/index.js'
import type { AppealView } from '../lexicons/tools/ozone/inbox/defs.js'
import type { ModSubject } from '../mod-service/subject.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'
import { findMatchingQueue } from '../queue/service.js'

export const APPEAL_REASON_TYPE = 'tools.ozone.report.defs#reasonAppeal'
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
  createdAt: DatetimeString
  closedAt: DatetimeString | null
}

export type AppealInput = {
  subject: ModSubject
  status: ModerationSubjectStatusRow | null
  report: AppealReport | null
  publicNote: string | null

  /** Calendar months an action stays appealable, from `InboxConfig`. */
  windowMonths: number
  latestAppealableAt: DatetimeString | null
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
  actionCreatedAt: DatetimeString,
  windowMonths: number,
): DatetimeString => {
  const end = new Date(actionCreatedAt)
  const day = end.getUTCDate()
  end.setUTCMonth(end.getUTCMonth() + windowMonths)
  // Clamp a rollover: 31 Aug + 6 months is 28/29 Feb, not 2/3 Mar.
  if (end.getUTCDate() !== day) end.setUTCDate(0)
  return toDatetimeString(end)
}

export const isAppealWindowOpen = (
  actionCreatedAt: DatetimeString,
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
  if (subject.isMessage())
    return `message:${subjectDid}:${subjectConvoId}:${subjectMessageId}`
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
      eb('subjectConvoId', '=', subjectConvoId),
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

export const eventSubjectFilter = (
  eb: ExpressionBuilder<DatabaseSchemaType, 'moderation_event'>,
  subject: ModSubject,
): Expression<SqlBool> => {
  const {
    subjectType,
    subjectDid,
    subjectUri,
    subjectMessageId,
    subjectConvoId,
  } = subject.info()
  if (subject.isMessage()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectMessageId', '=', subjectMessageId),
      eb('subjectConvoId', '=', subjectConvoId),
    ])
  }
  if (subject.isConvo()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectConvoId', '=', subjectConvoId),
      eb('subjectMessageId', 'is', null),
    ])
  }
  if (subject.isRecord()) {
    return eb.and([
      eb('subjectDid', '=', subjectDid),
      eb('subjectUri', '=', subjectUri),
    ])
  }
  return eb.and([
    eb('subjectDid', '=', subjectDid),
    eb('subjectType', '=', subjectType),
  ])
}

export const findAppealedEvent = async (
  ctx: AppContext,
  subject: ModSubject,
  action: { type: 'label'; val: string } | { type: 'takedown' },
) => {
  let query = ctx.db.db
    .selectFrom('moderation_event')
    .where((eb) => eventSubjectFilter(eb, subject))
    .where('action', '=', action.type === 'label' ? LABEL : TAKEDOWN)

  if (action.type === 'label') {
    query = query.where(
      sql<boolean>`${action.val} = ANY(string_to_array("createLabelVals", ' '))`,
    )
  }

  const matches = await query
    .orderBy('id', 'desc')
    .limit(2)
    .selectAll()
    .execute()
  return matches.length === 1 ? matches[0] : undefined
}

export const resolveAppealAction = async (
  ctx: AppContext,
  subject: ModSubject,
  action: tools.ozone.inbox.appealActionedSubject.$InputBody['action'],
) => {
  if (!action) return undefined
  const reference = tools.ozone.inbox.appealActionedSubject
  if (reference.actionRef.$isTypeOf(action)) {
    return ctx.modService(ctx.db).getEvent(action.id)
  }
  if (reference.labelRef.$isTypeOf(action)) {
    return findAppealedEvent(ctx, subject, { type: 'label', val: action.val })
  }
  if (reference.takedownRef.$isTypeOf(action)) {
    return findAppealedEvent(ctx, subject, { type: 'takedown' })
  }
  throw new InvalidRequestError(
    'Unknown appeal action reference',
    'InvalidAppealSubject',
  )
}

/**
 * Label rows are keyed by a single string: the record URI, or the DID for an
 * account.
 */
export const subjectLabelUri = (subject: ModSubject): UriString =>
  (subject.info().subjectUri ?? subject.did) as UriString

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

export const findLatestAppealReport = async (
  db: Database,
  subject: ModSubject,
): Promise<AppealReport | null> => {
  const report = await db.db
    .selectFrom('report')
    .where('reportType', '=', APPEAL_REASON_TYPE)
    .where((eb) => reportSubjectFilter(eb, subject))
    .orderBy('id', 'desc')
    .select(['id', 'status', 'createdAt', 'closedAt'])
    .executeTakeFirst()
  return report ?? null
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
  await sql`select pg_advisory_xact_lock(
    hashtextextended(${subjectKey(subject)}, 0)
  )`.execute(dbTxn.db)

  const existing = await findLatestAppealReport(dbTxn, subject)

  if (appealsExhausted(subject, existing)) {
    throw new ForbiddenError(
      subject.isRepo()
        ? 'Awaiting decision on previous appeal'
        : 'This has already been appealed',
      'AlreadyAppealed',
    )
  }
}

export type FileAppealInput = {
  /** DID of the affected account, shown as the appeal reporter. */
  requester: DidString
  /** Moderator filing on the affected account's behalf, when applicable. */
  submittedBy?: DidString
  /** The subject being appealed, already resolved and authorized. */
  subject: ModSubject
  /** Resolved moderation event ID, when one could be found. */
  resolvedActionId?: number
  /** The action reference supplied by the caller. */
  action?: tools.ozone.inbox.appealActionedSubject.$InputBody['action']
  /** Optional: an appeal is a request for review, not an argued case. */
  reason?: string
  modTool?: { name: string; meta?: { [_ in string]: unknown } }
}

const buildAppealEventMeta = (
  action: FileAppealInput['action'],
): Record<string, string | number | boolean> | undefined => {
  if (!action) return undefined
  const meta: Record<string, string | number | boolean> = {
    appealActionType: action.$type,
  }
  const reference = tools.ozone.inbox.appealActionedSubject
  if (reference.actionRef.$isTypeOf(action)) {
    meta.appealActionId = action.id
  } else if (reference.labelRef.$isTypeOf(action)) {
    meta.appealLabel = action.val
  }
  return meta
}

const findSourceQueueIds = async (
  db: Database,
  subject: ModSubject,
  actionId: number,
): Promise<(number | null)[]> => {
  // @NOTE Closed reports retain the source action link. Query each status
  // separately so the existing active-subject and closed-DID indexes apply.
  const query = db.db
    .selectFrom('report')
    .where((eb) => reportSubjectFilter(eb, subject))
    .where('reportType', '!=', APPEAL_REASON_TYPE)
    .where('actionEventIds', '@>', jsonb([actionId]))

  const [active, closed] = await Promise.all([
    query
      .where(sql<boolean>`status != 'closed'`)
      .select('queueId')
      .execute(),
    query
      .where(sql<boolean>`status = 'closed'`)
      .select('queueId')
      .execute(),
  ])
  return [...active, ...closed].map((report) => report.queueId)
}

/**
 * Pick the queue an appeal should land in.
 *
 * A linked appeal inherits the queue of the report the appealed action
 * resolved, but only when every candidate agrees - bulk and collateral actions
 * can link one event to reports sitting in different queues, and guessing
 * between them is worse than using normal appeal routing. An unlinked or
 * ambiguously linked appeal falls back to whatever queue accepts appeals.
 *
 * This is a read of best-effort routing data, so it deliberately runs outside
 * the appeal transaction: holding the subject lock across a queue listing and
 * a report scan would serialize unrelated appeals for no consistency gain, and
 * if the routing data moves underneath us the router reassigns anyway.
 */
const selectQueue = async (
  ctx: AppContext,
  subject: ModSubject,
  resolvedActionId: number | undefined,
  action: FileAppealInput['action'],
) => {
  const sourceQueueIds =
    resolvedActionId === undefined
      ? []
      : await findSourceQueueIds(ctx.db, subject, resolvedActionId)
  const allSourcesAssigned =
    sourceQueueIds.length > 0 &&
    sourceQueueIds.every(
      (queueId): queueId is number => queueId !== null && queueId > 0,
    )
  const sourceQueues = new Set(sourceQueueIds)
  let queueId: number | null =
    allSourcesAssigned && sourceQueues.size === 1
      ? (sourceQueueIds[0] as number)
      : null
  const queueService = ctx.queueService(ctx.db)
  if (
    queueId === null &&
    action &&
    tools.ozone.inbox.appealActionedSubject.labelRef.$isTypeOf(action)
  ) {
    queueId = (await queueService.getByRecommendedLabel(action.val))?.id ?? null
  }
  if (queueId === null) {
    const { queues } = await queueService.list({ limit: 1000, enabled: true })
    const subjectUri = subject.info().subjectUri
    const collection = subjectUri ? new AtUri(subjectUri).collection : null
    queueId =
      findMatchingQueue(
        queues,
        subject.isRecord() ? 'record' : 'account',
        collection,
        APPEAL_REASON_TYPE,
      )?.id ?? -1
  }

  // An unrouted report carries no queue timestamp: `queuedAt` records when a
  // report entered a queue, and matches the `queueId: -1` / `status: 'open'`
  // shape the queue service uses for everything it cannot route.
  return {
    queueId,
    queuedAt: queueId > 0 ? currentDatetimeString() : null,
  }
}

/**
 * File an appeal: validate the subject, route it, and record it.
 *
 * An appeal is an ordinary `reasonAppeal` report, so it inherits the report
 * lifecycle, queue routing, and activity machinery rather than introducing a
 * parallel one. What makes it a *linked* appeal is `actionEventIds`, whose
 * first entry is the action being challenged.
 *
 * Everything that must be atomic - the eligibility guard, the report event,
 * and the report row - shares one transaction. Everything that needs
 * not be, is already done by the time it opens.
 */
export const fileAppeal = async (
  ctx: AppContext,
  {
    requester,
    submittedBy,
    subject,
    resolvedActionId,
    action,
    reason,
    modTool,
  }: FileAppealInput,
): Promise<{ reportId: number }> => {
  const { queueId, queuedAt } = await selectQueue(
    ctx,
    subject,
    resolvedActionId,
    action,
  )

  const reportId = await ctx.db.transaction(async (dbTxn) => {
    await assertAppealAllowed(dbTxn, subject)

    // create event and report row
    const moderationTxn = ctx.modService(dbTxn)
    const { event: reportEvent } = await moderationTxn.report({
      reason,
      subject,
      reasonType: APPEAL_REASON_TYPE,
      reportedBy: requester,
      modTool,
      eventMeta: {
        ...buildAppealEventMeta(action),
        ...(submittedBy ? { appealSubmittedBy: submittedBy } : {}),
      },
    })
    return ctx.queueService(dbTxn).insertReportFromEvent({
      event: reportEvent,
      reportType: APPEAL_REASON_TYPE,
      queueId,
      queuedAt,
      actionEventIds:
        resolvedActionId === undefined ? null : [resolvedActionId],
    })
  })

  return { reportId }
}
