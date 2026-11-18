import { sql } from 'kysely'
import { isDatetimeString } from '@atproto/lex-schema'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { AppContext } from '../context.js'
import type { tools } from '../lexicons/index.js'
import { getReportsByIds } from '../mod-service/report.js'
import { formatActivityView } from './activity.js'

type Params = tools.ozone.report.queryModeratorActivity.$Params
type Row = tools.ozone.report.queryModeratorActivity.ActivityRow
type ActivityKey = Pick<Row, 'id' | 'createdAt' | 'source'>

function unpackCursor(token: string): ActivityKey {
  try {
    if (token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error()
    const key = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (
      !key ||
      !isDatetimeString(key.createdAt) ||
      !['event', 'activity'].includes(key.source) ||
      !Number.isSafeInteger(key.id) ||
      key.id < 1
    )
      throw new Error()
    return key
  } catch {
    throw new InvalidRequestError('Invalid activity cursor')
  }
}

/** Read a bounded chronological page from existing human activity records. */
export async function queryModeratorActivity(
  ctx: AppContext,
  params: Params,
  signal: AbortSignal,
): Promise<tools.ozone.report.queryModeratorActivity.$OutputBody> {
  if (Date.parse(params.createdAfter) >= Date.parse(params.createdBefore)) {
    throw new InvalidRequestError('Activity start must precede end')
  }
  const previous = params.cursor ? unpackCursor(params.cursor) : undefined
  const options = {
    signal,
    inflightQueryAbortStrategy: 'cancel query' as const,
  }
  const limit = params.limit
  const seek = (alias: string, source: ActivityKey['source']) =>
    previous
      ? sql<boolean>`(${sql.ref(`${alias}.createdAt`)}, ${source}::text, ${sql.ref(`${alias}.id`)}) < (${previous.createdAt}, ${previous.source}::text, ${previous.id})`
      : sql<boolean>`true`
  const types = (column: string) =>
    params.types?.length
      ? sql<boolean>`${sql.ref(column)} IN (${sql.join(params.types)})`
      : sql<boolean>`true`
  const candidates = await sql<ActivityKey>`
    SELECT * FROM (
      (SELECT e.id, e."createdAt", 'event'::text AS source
       FROM moderation_event e
       WHERE e."createdBy" = ${params.moderator}
         AND e."createdAt" >= ${params.createdAfter} AND e."createdAt" < ${params.createdBefore}
         AND ${types('e.action')} AND ${seek('e', 'event')}
         AND (e."modTool" -> 'meta' ->> 'isAutomated') IS DISTINCT FROM 'true'
       ORDER BY e."createdAt" DESC, e.id DESC LIMIT ${limit + 1})
      UNION ALL
      (SELECT a.id, a."createdAt", 'activity'::text AS source
       FROM report_activity a
       WHERE a."createdBy" = ${params.moderator}
         AND a."createdAt" >= ${params.createdAfter} AND a."createdAt" < ${params.createdBefore}
         AND ${types('a.activityType')} AND ${seek('a', 'activity')}
         AND a."isAutomated" = false
       ORDER BY a."createdAt" DESC, a.id DESC LIMIT ${limit + 1})
    ) candidates ORDER BY "createdAt" DESC, source DESC, id DESC LIMIT ${limit + 1}
  `.execute(ctx.db.db, options)
  const page = candidates.rows.slice(0, limit)
  const eventIds = page.filter((r) => r.source === 'event').map((r) => r.id)
  const activityIds = page
    .filter((r) => r.source === 'activity')
    .map((r) => r.id)
  const modService = ctx.modService(ctx.db)
  const events = await modService.getEventsByIds(eventIds, signal)
  const activities = activityIds.length
    ? await ctx.db.db
        .selectFrom('report_activity')
        .selectAll()
        .where('id', 'in', activityIds)
        .execute(options)
    : []
  const reports = await getReportsByIds(
    ctx.db,
    [...new Set(activities.map((a) => a.reportId))],
    signal,
  )
  const reportMap = new Map(reports.map((r) => [r.id, r]))
  const rows = new Map<string, Row>()
  for (const event of events) {
    rows.set(`event:${event.id}`, {
      source: 'event',
      id: event.id,
      type: event.action,
      createdAt: event.createdAt,
      createdBy: event.createdBy,
      subject: event.subjectUri ?? event.subjectDid,
      event: modService.views.formatEvent(event),
    })
  }
  for (const activity of activities) {
    const report = reportMap.get(activity.reportId)
    if (!report) continue
    const meta = activity.meta as { actionEventId?: unknown } | null
    const actionEventId = meta?.actionEventId
    rows.set(`activity:${activity.id}`, {
      source: 'activity',
      id: activity.id,
      type: activity.activityType,
      createdAt: activity.createdAt,
      createdBy: activity.createdBy,
      subject: report.subjectUri ?? report.subjectDid,
      reportId: activity.reportId,
      actionEventId:
        typeof actionEventId === 'number' &&
        Number.isSafeInteger(actionEventId) &&
        actionEventId > 0
          ? actionEventId
          : undefined,
      activity: formatActivityView(activity),
    })
  }
  return {
    rows: page.flatMap((row) => rows.get(`${row.source}:${row.id}`) ?? []),
    cursor:
      candidates.rows.length > limit
        ? Buffer.from(JSON.stringify(page.at(-1))).toString('base64url')
        : undefined,
  }
}
