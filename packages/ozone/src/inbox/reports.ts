import { sql } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import { tools } from '../lexicons/index.js'
import { subjectFromEventRow } from '../mod-service/subject.js'
import type { ModerationEventRow } from '../mod-service/types.js'
import { APPEAL_REASON_TYPE, REVERSE_TAKEDOWN } from './appeal.js'
import { isRead } from './seen.js'
import { publicActionType, toActionViews } from './views.js'

function reportQuery(db: Database, reporter: DidString) {
  return db.db
    .selectFrom('moderation_event as me')
    .innerJoin('report as r', 'r.eventId', 'me.id')
    .where('me.createdBy', '=', reporter)
    .where('me.action', '=', tools.ozone.moderation.defs.modEventReport.$type)
    .where('r.reportType', '!=', APPEAL_REASON_TYPE)
    .selectAll('me')
    .select([
      'r.id as internalReportId',
      'r.status as reportStatus',
      'r.reportType as reportReasonType',
      'r.createdAt as reportCreatedAt',
      'r.updatedAt as reportUpdatedAt',
      'r.closedAt as reportClosedAt',
      'r.actionEventIds',
    ])
}

/** Load one public report by its report ID and its owner. */
export async function findInboxReport(
  db: Database,
  reporter: DidString,
  reportId: number,
) {
  return reportQuery(db, reporter)
    .where('r.id', '=', reportId)
    .executeTakeFirst()
}

export async function queryInboxReports(
  db: Database,
  reporter: DidString,
  params: tools.ozone.inbox.listReports.$Params,
  seenAt: DatetimeString | null,
) {
  const field = params.sortField ?? 'updatedAt'
  const direction = params.sortDirection ?? 'desc'
  const limit = params.limit ?? 50
  const sortColumn = field === 'createdAt' ? 'r.createdAt' : 'r.updatedAt'
  let query = reportQuery(db, reporter)
  if (params.filter === 'pending')
    query = query.where('r.status', '!=', 'closed')
  if (params.filter === 'resolved')
    query = query.where('r.status', '=', 'closed')
  if (params.filter === 'unread' && seenAt) {
    query = query.where('r.updatedAt', '>', seenAt)
  }
  if (params.cursor) {
    const match = /^(.*)::([1-9]\d*)$/.exec(params.cursor)
    if (!match || !Number.isSafeInteger(Number(match[2]))) {
      throw new InvalidRequestError('Invalid cursor')
    }
    const [, sortValue, id] = match
    query = query.where(
      direction === 'desc'
        ? sql<boolean>`(${sql.ref(sortColumn)}, r.id) < (${sortValue}, ${Number(id)})`
        : sql<boolean>`(${sql.ref(sortColumn)}, r.id) > (${sortValue}, ${Number(id)})`,
    )
  }

  const rows = await query
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
  events: Map<number, ModerationEventRow>
  closingEventIds: Map<number, number>
}

export async function loadReportActions(
  db: Database,
  rows: InboxReportRow[],
): Promise<ReportActions> {
  const ids = [...new Set(rows.flatMap((row) => row.actionEventIds ?? []))]
  const closedReportIds = rows
    .filter((row) => row.reportStatus === 'closed')
    .map((row) => row.internalReportId)
  const [events, activities] = await Promise.all([
    ids.length
      ? db.db
          .selectFrom('moderation_event')
          .where('id', 'in', ids)
          .selectAll()
          .execute()
      : Promise.resolve([]),
    closedReportIds.length
      ? db.db
          .selectFrom('report_activity')
          .where('reportId', 'in', closedReportIds)
          .where('activityType', '=', 'closeActivity')
          .select(['reportId', 'meta'])
          .orderBy('createdAt', 'desc')
          .orderBy('id', 'desc')
          .execute()
      : Promise.resolve([]),
  ])
  const closingEventIds = new Map<number, number>()
  const seenClosures = new Set<number>()
  for (const activity of activities) {
    if (seenClosures.has(activity.reportId)) continue
    seenClosures.add(activity.reportId)
    const id = (activity.meta as { actionEventId?: unknown } | null)
      ?.actionEventId
    if (typeof id === 'number') closingEventIds.set(activity.reportId, id)
  }
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
  if (id !== undefined) return actions.events.get(id) ?? null

  // @NOTE Old reports lack the activity link. Only attribute an event when it
  // occurred in the same brief window as closure; stale linked events are not
  // evidence that a later bulk close took that action.
  const closedAt = row.reportClosedAt
  if (!closedAt) return null
  return (
    (row.actionEventIds ?? [])
      .map((eventId) => actions.events.get(eventId))
      .filter((event): event is ModerationEventRow => !!event)
      .sort((a, b) => b.id - a.id)
      .find((event) => {
        const delta = Date.parse(closedAt) - Date.parse(event.createdAt)
        return delta >= 0 && delta <= 10_000
      }) ?? null
  )
}
