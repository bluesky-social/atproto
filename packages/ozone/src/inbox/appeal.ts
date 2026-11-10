import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  type UriString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/lex-schema'
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
import { findMatchingQueue, getQueueRoutingNote } from '../queue/service.js'
import {
  type AppealOutcome,
  appealActivityOutcome,
  appealReportSelection,
  appealResolutionFilter,
} from './appeal-outcome.js'

export const APPEAL_REASON_TYPE = tools.ozone.report.defs.ReasonAppeal
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
  updatedAt: DatetimeString
  closedAt: DatetimeString | null
  outcome?: AppealOutcome | null
}

export type AppealEligibility = {
  hasActiveAppeal: boolean
  lastClosedAt: DatetimeString | null
  hasUnknownClosure: boolean
}

export type AppealInput = {
  subject: ModSubject
  status: Pick<ModerationSubjectStatusRow, 'appealed' | 'lastAppealedAt'> | null
  report: AppealReport | null
  /** Eligibility retains older appeals even when their history is hidden. */
  eligibilityReport?: AppealReport | null
  eligibility?: AppealEligibility

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

export const isAppealableEvent = (event: {
  action: string
  createLabelVals: string | null
}): boolean =>
  event.action === TAKEDOWN ||
  (event.action === LABEL && !!event.createLabelVals?.trim())

export function hasKnownLatestAppealable(
  latest: DatetimeString | null,
  events: readonly {
    createdAt: DatetimeString
    action: string
    createLabelVals: string | null
  }[],
): boolean {
  return (
    !latest ||
    events.some(
      (event) => event.createdAt === latest && isAppealableEvent(event),
    )
  )
}

// @NOTE Use the same predicate for history aggregates and submission checks.
export const appealableEventFilter = sql<boolean>`(action = ${sql.lit(TAKEDOWN)} OR
  (action = ${sql.lit(LABEL)} AND nullif(btrim("createLabelVals"), '') IS NOT NULL))`

export const appealReportTypeFilter = sql<boolean>`"reportType" = ${sql.lit(APPEAL_REASON_TYPE)}`

export const appealReportOrder = sql<number>`CASE WHEN status <> 'closed' THEN 0 ELSE 1 END`

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
  status,
  report,
  eligibilityReport = report,
  eligibility = eligibilityFromReport(eligibilityReport),
  latestAppealableAt,
  windowMonths,
}: AppealInput): AppealState => {
  const appealableUntil = latestAppealableAt
    ? appealWindowEnd(latestAppealableAt, windowMonths)
    : null
  const windowOpen = !!appealableUntil && new Date(appealableUntil) > new Date()

  let state: AppealView['state']
  if (report) {
    // @NOTE Report activities do not maintain the subject's appealed flag.
    // Use the same source of truth as the appeal submission guard.
    state = report.status === 'closed' ? 'resolved' : 'pending'
  } else {
    state = appealableUntil && !windowOpen ? 'expired' : 'none'
  }

  const view: AppealView = { state }
  if (report) {
    view.appealedAt = status?.lastAppealedAt ?? report.createdAt
    if (state === 'resolved' && report.closedAt)
      view.resolvedAt = report.closedAt
    if (state === 'resolved' && report.outcome) view.outcome = report.outcome
  }
  if (appealableUntil) view.appealableUntil = appealableUntil

  const availableActions =
    windowOpen && !appealsExhausted(eligibility, latestAppealableAt)
      ? ['appeal']
      : []

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
      eb('subjectType', '=', subjectType),
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
    .$if(ctx.cfg.inbox.startAt !== undefined, (qb) =>
      qb.where('createdAt', '>=', ctx.cfg.inbox.startAt!),
    )

  if (action.type === 'label') {
    query = query.where(
      sql<boolean>`${action.val} = ANY(string_to_array("createLabelVals", ' '))`,
    )
  }

  const match = await query
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(1)
    .selectAll()
    .executeTakeFirst()
  return match
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
 * Whether the subject's appeal history blocks this action.
 */
export const eligibilityFromReport = (
  report: AppealReport | null,
): AppealEligibility => ({
  hasActiveAppeal: !!report && report.status !== 'closed',
  lastClosedAt: report?.status === 'closed' ? report.closedAt : null,
  hasUnknownClosure: !!report && report.status === 'closed' && !report.closedAt,
})

export const appealsExhausted = (
  eligibility: AppealEligibility,
  actionAt: DatetimeString | null,
): boolean =>
  eligibility.hasActiveAppeal ||
  eligibility.hasUnknownClosure ||
  (!!eligibility.lastClosedAt &&
    (!actionAt || actionAt <= eligibility.lastClosedAt))

export const findAppealCandidates = async (
  db: Database,
  subject: ModSubject,
): Promise<{
  activeId: number | null
  closedId: number | null
  closedAt: DatetimeString | null
}> => {
  const query = db.db
    .selectFrom('report')
    .where(appealReportTypeFilter)
    .where((eb) => reportSubjectFilter(eb, subject))
  const [active, closed] = await Promise.all([
    query
      .where(sql<boolean>`status <> 'closed'`)
      .select('id')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst(),
    query
      .where(sql<boolean>`status = 'closed'`)
      .select(['id', 'closedAt'])
      .orderBy(sql`"closedAt" DESC NULLS FIRST`)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst(),
  ])
  return {
    activeId: active?.id ?? null,
    closedId: closed?.id ?? null,
    closedAt: closed?.closedAt ?? null,
  }
}

export const eligibilityFromCandidates = (candidates: {
  activeId: number | null
  closedId: number | null
  closedAt: DatetimeString | null
}): AppealEligibility => ({
  hasActiveAppeal: candidates.activeId !== null,
  lastClosedAt: candidates.closedAt,
  hasUnknownClosure:
    candidates.closedId !== null && candidates.closedAt === null,
})

export const findAppealEligibility = async (
  db: Database,
  subject: ModSubject,
): Promise<AppealEligibility> =>
  eligibilityFromCandidates(await findAppealCandidates(db, subject))

const findAppealReport = async (
  db: Database,
  reportId: number,
): Promise<AppealReport | null> => {
  const report = await db.db
    .selectFrom(
      db.db
        .selectFrom('report')
        .where('id', '=', reportId)
        .select(appealReportSelection)
        .as('report'),
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('report_activity')
          .where('report.status', '=', 'closed')
          .whereRef('reportId', '=', 'report.id')
          .where('activityType', '=', 'closeActivity')
          .whereRef('createdAt', '=', 'report.closedAt')
          .orderBy('id', 'desc')
          .limit(1)
          .select(['id', 'activityType', 'meta'])
          .as('closure'),
      (join) => join.onTrue(),
    )
    .leftJoin('moderation_event as resolution', (join) =>
      join.on(appealResolutionFilter('report', 'closure')),
    )
    .select([
      'report.id',
      'report.status',
      'report.createdAt',
      'report.updatedAt',
      'report.closedAt',
    ])
    .select(appealActivityOutcome('report', 'closure').as('outcome'))
    .executeTakeFirst()
  return report ?? null
}

export const findAppealHistory = async (db: Database, subject: ModSubject) => {
  const candidates = await findAppealCandidates(db, subject)
  const reportId = candidates.activeId ?? candidates.closedId
  return {
    eligibility: eligibilityFromCandidates(candidates),
    report: reportId === null ? null : await findAppealReport(db, reportId),
  }
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
  options: {
    actionAt?: DatetimeString
    unresolvedAction?: boolean
    startAt?: DatetimeString
    windowMonths: number
  },
) => {
  dbTxn.assertTransaction()
  await sql`select pg_advisory_xact_lock(
    hashtextextended(${subjectKey(subject)}, 0)
  )`.execute(dbTxn.db)

  const eligibility = await findAppealEligibility(dbTxn, subject)
  if (
    options.unresolvedAction &&
    (eligibility.hasActiveAppeal ||
      eligibility.hasUnknownClosure ||
      eligibility.lastClosedAt)
  ) {
    throw new ForbiddenError('Moderation action not found', 'AlreadyAppealed')
  }
  let actionAt = options.actionAt ?? null
  if (!actionAt && eligibility.lastClosedAt && !eligibility.hasActiveAppeal) {
    const latest = await dbTxn.db
      .selectFrom('moderation_event')
      .where((eb) => eventSubjectFilter(eb, subject))
      .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
      .where(appealableEventFilter)
      .where('createdAt', '>', eligibility.lastClosedAt)
      .$if(options.startAt !== undefined, (qb) =>
        qb.where('createdAt', '>=', options.startAt!),
      )
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .select('createdAt')
      .limit(1)
      .executeTakeFirst()
    actionAt = latest?.createdAt ?? null
    if (actionAt && !isAppealWindowOpen(actionAt, options.windowMonths)) {
      actionAt = null
    }
  }

  if (appealsExhausted(eligibility, actionAt)) {
    throw new ForbiddenError(
      eligibility.hasActiveAppeal
        ? 'Awaiting decision on previous appeal'
        : 'No new appealable action since the previous appeal',
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
  resolvedActionAt?: DatetimeString
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
 * ambiguously linked appeal tries label mappings, then the ordinary queue
 * criteria, including account tags and report types.
 *
 * This is a read of best-effort routing data, so it deliberately runs outside
 * the appeal transaction: holding the subject lock across a queue listing and
 * a report scan would serialize unrelated appeals for no consistency gain, and
 * tag changes do not need to be synchronized with appeal creation.
 */
const selectQueue = async (
  ctx: AppContext,
  subject: ModSubject,
  requester: DidString,
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
  let routingNote: string | undefined
  if (
    queueId === null &&
    action &&
    tools.ozone.inbox.appealActionedSubject.labelRef.$isTypeOf(action)
  ) {
    queueId =
      (await ctx.queueService(ctx.db).getByRecommendedLabel(action.val))?.id ??
      null
  }
  if (queueId === null) {
    const queueService = ctx.queueService(ctx.db)
    const { queues } = await queueService.list({ limit: 1000, enabled: true })
    const accountTags = await queueService.loadAccountTags(queues, [
      requester,
      subject.did,
    ])
    const subjectUri = subject.info().subjectUri
    const collection = subjectUri ? new AtUri(subjectUri).collection : null
    const matched = findMatchingQueue(
      queues,
      subject.isRecord() ? 'record' : 'account',
      collection,
      APPEAL_REASON_TYPE,
      accountTags.get(requester) ?? [],
      accountTags.get(subject.did) ?? [],
    )
    queueId = matched?.id ?? -1
    if (matched) {
      routingNote = getQueueRoutingNote(
        matched,
        accountTags.get(requester) ?? [],
        accountTags.get(subject.did) ?? [],
      )
    }
  }

  // An unrouted report carries no queue timestamp: `queuedAt` records when a
  // report entered a queue, and matches the `queueId: -1` / `status: 'open'`
  // shape the queue service uses for everything it cannot route.
  return {
    queueId,
    queuedAt: queueId > 0 ? currentDatetimeString() : null,
    routingNote,
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
    resolvedActionAt,
    action,
    reason,
    modTool,
  }: FileAppealInput,
): Promise<{ reportId: number }> => {
  const { queueId, queuedAt, routingNote } = await selectQueue(
    ctx,
    subject,
    requester,
    resolvedActionId,
    action,
  )

  const reportId = await ctx.db.transaction(async (dbTxn) => {
    await assertAppealAllowed(dbTxn, subject, {
      actionAt: resolvedActionAt,
      unresolvedAction: !!action && !resolvedActionAt,
      startAt: ctx.cfg.inbox.startAt,
      windowMonths: ctx.cfg.inbox.appealWindowMonths,
    })

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
      routingNote,
      actionEventIds:
        resolvedActionId === undefined ? null : [resolvedActionId],
    })
  })

  return { reportId }
}
