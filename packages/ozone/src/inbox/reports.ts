import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import { tools } from '../lexicons/index.js'
import { subjectFromEventRow } from '../mod-service/subject.js'
import { APPEAL_REASON_TYPE, REVERSE_TAKEDOWN } from './appeal.js'
import { isRead } from './seen.js'
import { inboxHasStarted } from './start.js'
import { parseSubjectCursor } from './subjects.js'
import {
  type PublicEventRow,
  publicActionType,
  publicEventSelection,
  toActionViews,
} from './views.js'

const reportSelection = [
  'me.subjectType',
  'me.subjectDid',
  'me.subjectUri',
  'me.subjectCid',
  'me.subjectBlobCids',
  'me.subjectMessageId',
  'me.subjectConvoId',
  'me.comment',
  sql<
    PublicEventRow['meta']
  >`jsonb_build_object('convoId', me.meta->'convoId')`.as('meta'),
  'r.id as internalReportId',
  'r.status as reportStatus',
  'r.reportType as reportReasonType',
  'r.createdAt as reportCreatedAt',
  'r.updatedAt as reportUpdatedAt',
  'r.closedAt as reportClosedAt',
] as const

function reportQuery(
  db: Database,
  reporter: DidString,
  startAt?: DatetimeString,
) {
  return db.db
    .selectFrom('moderation_event as me')
    .innerJoin('report as r', 'r.eventId', 'me.id')
    .where('me.createdBy', '=', reporter)
    .where('me.action', '=', tools.ozone.moderation.defs.modEventReport.$type)
    .where('r.reportType', '!=', APPEAL_REASON_TYPE)
    .$if(startAt !== undefined, (qb) => qb.where('r.createdAt', '>=', startAt!))
    .select(reportSelection)
}

/** Load one public report by its report ID and its owner. */
export async function findInboxReport(
  db: Database,
  reporter: DidString,
  reportId: number,
  startAt?: DatetimeString,
) {
  if (!inboxHasStarted(startAt)) return undefined
  return reportQuery(db, reporter, startAt)
    .where('r.id', '=', reportId)
    .executeTakeFirst()
}

export async function queryInboxReports(
  db: Database,
  reporter: DidString,
  params: tools.ozone.inbox.listReports.$Params,
  seenAt: DatetimeString | null,
  startAt?: DatetimeString,
) {
  if (!inboxHasStarted(startAt)) return { rows: [], cursor: undefined }
  const field = params.sortField ?? 'updatedAt'
  const direction = params.sortDirection ?? 'desc'
  const limit = params.limit ?? 50
  const sortColumn = field === 'createdAt' ? 'r.createdAt' : 'r.updatedAt'
  // @NOTE Seek the reporter/time index first. The lateral primary-key check
  // rejects corrupt ownership/source rows before LIMIT without scanning events.
  let query = db.db
    .selectFrom('report as r')
    .innerJoinLateral(
      (eb) =>
        eb
          .selectFrom('moderation_event')
          .whereRef('id', '=', 'r.eventId')
          .where('createdBy', '=', reporter)
          .where(
            'action',
            '=',
            tools.ozone.moderation.defs.modEventReport.$type,
          )
          .select('id')
          .limit(1)
          .as('source'),
      (join) => join.onTrue(),
    )
    .where('r.reporterDid', '=', reporter)
    .where('r.reportType', '!=', APPEAL_REASON_TYPE)
    .$if(startAt !== undefined, (qb) => qb.where('r.createdAt', '>=', startAt!))
  if (params.filter === 'pending')
    query = query.where('r.status', '!=', 'closed')
  if (params.filter === 'resolved')
    query = query.where('r.status', '=', 'closed')
  if (params.filter === 'unread' && seenAt) {
    query = query.where('r.updatedAt', '>', seenAt)
  }
  if (params.cursor) {
    const { sortValue, id } = parseSubjectCursor(params.cursor)
    query = query.where(
      direction === 'desc'
        ? sql<boolean>`(${sql.ref(sortColumn)}, r.id) < (${sortValue}, ${Number(id)})`
        : sql<boolean>`(${sql.ref(sortColumn)}, r.id) > (${sortValue}, ${Number(id)})`,
    )
  }

  const candidates = query
    .select([
      'r.id',
      'r.eventId',
      'r.status',
      'r.reportType',
      'r.createdAt',
      'r.updatedAt',
      'r.closedAt',
    ])
    .orderBy(sortColumn, direction)
    .orderBy('r.id', direction)
    .limit(limit + 1)
  // @NOTE One statement/snapshot; only the bounded page loads public source data.
  const rows = await db.db
    .with(
      (cte) => cte('inbox_report_page').materialized(),
      () => candidates,
    )
    .selectFrom('inbox_report_page as r')
    .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
    .select(reportSelection)
    .orderBy(sortColumn, direction)
    .orderBy('r.id', direction)
    .limit(limit + 1)
    .execute()
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    rows: page,
    cursor:
      hasMore && last
        ? `${field === 'createdAt' ? last.reportCreatedAt : last.reportUpdatedAt}::${last.internalReportId}`
        : undefined,
  }
}

export type InboxReportRow = NonNullable<
  Awaited<ReturnType<typeof findInboxReport>>
>

export type ReportActions = {
  events: Map<number, PublicEventRow>
  closingEventIds: Map<number, number>
}

export async function loadReportActions(
  db: Database,
  rows: InboxReportRow[],
  startAt?: DatetimeString,
): Promise<ReportActions> {
  const closedReportIds = rows
    .filter((row) => row.reportStatus === 'closed')
    .map((row) => row.internalReportId)
  const activities = closedReportIds.length
    ? await db.db
        .selectFrom('report as r')
        .where('r.id', 'in', closedReportIds)
        .innerJoinLateral(
          (eb) =>
            eb
              .selectFrom('report_activity')
              .whereRef('reportId', '=', 'r.id')
              .where('activityType', '=', 'closeActivity')
              .select('meta')
              .orderBy('createdAt', 'desc')
              .orderBy('id', 'desc')
              .limit(1)
              .as('closure'),
          (join) => join.onTrue(),
        )
        .select(['r.id as reportId', 'closure.meta'])
        .execute()
    : []
  const closingEventIds = new Map<number, number>()
  for (const activity of activities) {
    const id = (activity.meta as { actionEventId?: unknown } | null)
      ?.actionEventId
    if (typeof id === 'number') closingEventIds.set(activity.reportId, id)
  }
  const ids = [...new Set(closingEventIds.values())]
  const events = ids.length
    ? await db.db
        .selectFrom('moderation_event')
        .where('id', 'in', ids)
        .$if(startAt !== undefined, (qb) =>
          qb.where('createdAt', '>=', startAt!),
        )
        .select(publicEventSelection)
        .execute()
    : []
  return {
    events: new Map(events.map((event) => [event.id, event])),
    closingEventIds,
  }
}

export function toReportListView(
  row: InboxReportRow,
  serviceDid: DidString,
  seenAt: DatetimeString | null,
  actions: ReportActions,
): tools.ozone.inbox.listReports.ReportView {
  const action = latestReportAction(row, actions)
  const view: tools.ozone.inbox.listReports.ReportView = {
    src: serviceDid,
    id: row.internalReportId,
    isRead: isRead(row.reportUpdatedAt, seenAt),
    reasonType: row.reportReasonType,
    subject: subjectFromEventRow(
      row,
    ).lex() as tools.ozone.inbox.listReports.ReportView['subject'],
    status: row.reportStatus === 'closed' ? 'resolved' : 'pending',
    createdAt: row.reportCreatedAt,
    updatedAt: row.reportUpdatedAt,
  }
  if (row.comment) view.reason = row.comment
  if (row.reportStatus === 'closed' && action) {
    view.lastActionTaken = action.type
    if (action.scope) view.scope = action.scope
  }
  return view
}

export function toReportDetail(
  row: InboxReportRow,
  serviceDid: DidString,
  actions: ReportActions,
): tools.ozone.inbox.getReport.$OutputBody {
  const listView = toReportListView(row, serviceDid, null, actions)
  const {
    isRead: _isRead,
    lastActionTaken: _action,
    scope: _scope,
    ...report
  } = listView
  const body: tools.ozone.inbox.getReport.$OutputBody = {
    report: report as tools.ozone.inbox.getReport.ReportView,
  }
  if (row.reportStatus === 'closed' && row.reportClosedAt) {
    const action = latestReportAction(row, actions)
    const closingEvent = findClosingEvent(row, actions)
    const outcome = action
      ? 'actionTaken'
      : closingEvent?.action ===
          tools.ozone.moderation.defs.modEventAcknowledge.$type
        ? 'noAction'
        : 'other'
    body.resolution = {
      outcome,
      resolvedAt: row.reportClosedAt,
    }
    if (action) {
      body.resolution.actionTaken = action.type
      if (action.scope) body.resolution.scope = action.scope
    }
  }
  return body
}

function latestReportAction(row: InboxReportRow, actions: ReportActions) {
  const event = findClosingEvent(row, actions)
  if (!event) return null
  if (event.action === REVERSE_TAKEDOWN) {
    return {
      type: event.subjectUri ? 'contentRestored' : 'accountRestored',
      scope: undefined,
    }
  }
  if (!publicActionType(event)) return null
  return toActionViews([event])[0] ?? null
}

function findClosingEvent(row: InboxReportRow, actions: ReportActions) {
  const id = actions.closingEventIds.get(row.internalReportId)
  // @NOTE A nearby action is not evidence of what closed a report. Legacy
  // or manual closures without an explicit link have an unknown outcome.
  return id === undefined ? null : (actions.events.get(id) ?? null)
}
