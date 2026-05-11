import { Selectable, sql } from 'kysely'
import { ToolsOzoneQueueDefs } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { TimeIdKeyset, paginate } from '../db/pagination'
import { ReportQueue } from '../db/schema/report_queue'
import { jsonb } from '../db/types'
import { handleReportUpdate } from '../report/handle-report-update'
import { ReportStatsService } from '../report/stats'
import { viewQueueStats } from '../report/views'

const MOD_EVENT_REPORT_ACTION = 'tools.ozone.moderation.defs#modEventReport'
const REASON_OTHER = 'com.atproto.moderation.defs#reasonOther'

type SubjectType = 'account' | 'record' | 'message'

type ResolvedAssignment = {
  queueId: number
  queuedAt: string | null
  status: 'queued' | 'open'
}

function resolveAssignment(
  subjectType: SubjectType,
  collection: string | null,
  reportType: string,
  queues: Selectable<ReportQueue>[],
  now: string,
): ResolvedAssignment {
  const matched = findMatchingQueue(queues, subjectType, collection, reportType)
  if (matched) return { queueId: matched.id, queuedAt: now, status: 'queued' }
  return { queueId: -1, queuedAt: null, status: 'open' }
}

export type QueueServiceCreator = (db: Database) => QueueService

export class QueueService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new QueueService(db)
  }

  async checkConflict({
    subjectTypes,
    collection,
    reportTypes,
    excludeId,
  }: {
    subjectTypes: string[]
    collection?: string | null
    reportTypes: string[]
    excludeId?: number
  }): Promise<void> {
    // It's not ideal to load all rows and perform in memory checks in case we end up with a LOT of queues
    // but we are not foreseeing a lot of queue rows so this should be fine for the
    let qb = this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('deletedAt', 'is', null)

    if (excludeId !== undefined) {
      qb = qb.where('id', '!=', excludeId)
    }

    const existingQueues = await qb.execute()

    for (const existing of existingQueues) {
      const subjectTypesOverlap = subjectTypes.some((st) =>
        existing.subjectTypes.includes(st),
      )
      const collectionMatch = (collection ?? null) === existing.collection
      const reportTypesOverlap = reportTypes.some((rt) =>
        existing.reportTypes.includes(rt),
      )

      if (subjectTypesOverlap && collectionMatch && reportTypesOverlap) {
        throw new InvalidRequestError(
          `Queue configuration conflicts with existing queue: ${existing.name}`,
          'ConflictingQueue',
        )
      }
    }
  }

  async create({
    name,
    subjectTypes,
    collection,
    reportTypes,
    description,
    createdBy,
  }: {
    name: string
    subjectTypes: string[]
    collection?: string | null
    reportTypes: string[]
    description?: string | null
    createdBy: string
  }): Promise<Selectable<ReportQueue>> {
    const now = new Date().toISOString()
    return await this.db.db
      .insertInto('report_queue')
      .values({
        name,
        subjectTypes: jsonb(subjectTypes),
        collection: collection ?? null,
        reportTypes: jsonb(reportTypes),
        description: description ?? null,
        createdBy,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async getById(id: number): Promise<Selectable<ReportQueue> | undefined> {
    return await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
  }

  async getViewsByIds(
    ids: number[],
  ): Promise<Map<number, ToolsOzoneQueueDefs.QueueView>> {
    if (!ids.length) return new Map()
    const rows = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', 'in', ids)
      .execute()
    return new Map(rows.map((r) => [r.id, this.view(r)]))
  }

  async update(
    id: number,
    updates: { name?: string; enabled?: boolean; description?: string },
  ): Promise<Selectable<ReportQueue>> {
    const now = new Date().toISOString()
    return await this.db.db
      .updateTable('report_queue')
      .set({ ...updates, updatedAt: now })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async delete(id: number): Promise<void> {
    const now = new Date().toISOString()
    await this.db.db
      .updateTable('report_queue')
      .set({ deletedAt: now })
      .where('id', '=', id)
      .execute()
  }

  async migrateReports(
    fromQueueId: number,
    toQueueId?: number,
  ): Promise<number> {
    const now = new Date().toISOString()
    const results = await this.db.db
      .updateTable('report')
      .set({
        queueId: toQueueId ?? -1,
        queuedAt: toQueueId ? now : null,
        updatedAt: now,
      })
      .where('queueId', '=', fromQueueId)
      .where('status', '!=', 'closed')
      .execute()
    return results.reduce((sum, r) => sum + Number(r.numUpdatedRows), 0)
  }

  async list({
    limit,
    cursor,
    enabled,
    subjectType,
    collection,
    reportTypes,
  }: {
    limit: number
    cursor?: string
    enabled?: boolean
    subjectType?: string
    collection?: string
    reportTypes?: string[]
  }): Promise<{ queues: Selectable<ReportQueue>[]; cursor?: string }> {
    const { ref } = this.db.db.dynamic
    let qb = this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('deletedAt', 'is', null)

    if (enabled !== undefined) {
      qb = qb.where('enabled', '=', enabled)
    }

    if (subjectType !== undefined) {
      qb = qb.where(sql`"subjectTypes" @> ${jsonb([subjectType])}`)
    }

    if (collection !== undefined) {
      qb = qb.where('collection', '=', collection)
    }

    if (reportTypes && reportTypes.length > 0) {
      const conditions = reportTypes.map(
        (t) => sql`"reportTypes" @> ${jsonb([t])}`,
      )
      qb = qb.where(sql`(${sql.join(conditions, sql` OR `)})`)
    }

    const keyset = new TimeIdKeyset(ref('createdAt'), ref('id'))
    const paginatedBuilder = paginate(qb, {
      limit,
      cursor,
      keyset,
      direction: 'asc',
      tryIndex: true,
    })

    const queues = await paginatedBuilder.execute()

    return {
      queues,
      cursor: keyset.packFromResult(queues),
    }
  }

  view(queue: Selectable<ReportQueue>): ToolsOzoneQueueDefs.QueueView {
    return {
      id: queue.id,
      name: queue.name,
      subjectTypes: queue.subjectTypes,
      collection: queue.collection ?? undefined,
      reportTypes: queue.reportTypes,
      description: queue.description ?? undefined,
      createdBy: queue.createdBy,
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
      enabled: queue.enabled,
      deletedAt: queue.deletedAt ?? undefined,
      stats: {
        pendingCount: 0,
        actionedCount: 0,
        escalatedCount: 0,
        inboundCount: 0,
        actionRate: 0,
      },
    }
  }

  async viewsWithStats(
    queues: Selectable<ReportQueue>[],
  ): Promise<ToolsOzoneQueueDefs.QueueView[]> {
    const statsService = new ReportStatsService(this.db)
    const queueIds = queues.map((q) => q.id)
    const statsMap = await statsService.getLiveStatsForQueues(queueIds)

    return queues.map((queue) => {
      const view = this.view(queue)
      view.stats = viewQueueStats(statsMap.get(queue.id))
      return view
    })
  }

  /**
   * Re-route a range of existing reports against the current queue config.
   * Used by the manual `tools.ozone.queue.routeReports` endpoint to pick up
   * reports after queues are created or modified. New reports are inserted
   * by the daemon via `insertReportsFromEvents`, not here.
   */
  async assignReportBatch(
    params: { start: number; end: number; limit: number },
    opts?: { includeUnmatched?: boolean; serviceDid?: string },
  ): Promise<{
    processed: number
    assigned: number
    unmatched: number
    maxId: number
  }> {
    const { queues } = await this.list({ limit: 1000, enabled: true })

    if (!queues.length) {
      return { processed: 0, assigned: 0, unmatched: 0, maxId: 0 }
    }

    let query = this.db.db
      .selectFrom('report as r')
      .select([
        'r.id',
        'r.status',
        'r.reportType',
        'r.recordPath',
        'r.subjectMessageId',
      ])
      .where('r.status', '!=', 'closed')
      .where('r.id', '>=', params.start)
      .where('r.id', '<=', params.end)
      .orderBy('r.id', 'asc')
      .limit(params.limit)

    if (opts?.includeUnmatched) {
      query = query.where((qb) => {
        return qb.orWhere('r.queueId', 'is', null).orWhere('r.queueId', '=', -1)
      })
    } else {
      query = query.where('r.queueId', 'is', null)
    }

    const reports = await query.execute()

    if (!reports.length) {
      return { processed: 0, assigned: 0, unmatched: 0, maxId: 0 }
    }

    const now = new Date().toISOString()

    // Resolve each report's destination in memory — no DB calls in this loop
    type MatchedEntry = {
      id: number
      queueId: number
      nextStatus: string | null
      activity: { activityType: string; previousStatus: string } | null
    }

    const matchedByQueue = new Map<number, MatchedEntry[]>()
    const unmatchedIds: number[] = []
    let maxReportId = 0

    for (const report of reports) {
      const subjectType: SubjectType = report.subjectMessageId
        ? 'message'
        : report.recordPath
          ? 'record'
          : 'account'

      // recordPath is 'collection/rkey' for records, '' for accounts
      const slashIdx = report.recordPath.indexOf('/')
      const collection =
        slashIdx > 0 ? report.recordPath.slice(0, slashIdx) : null

      const assignment = resolveAssignment(
        subjectType,
        collection,
        report.reportType,
        queues,
        now,
      )

      if (assignment.queueId !== -1) {
        // Existing-row UPDATE path uses handleReportUpdate so that already
        // escalated/closed/etc. reports keep their status — only open → queued
        // transitions emit a status change and an activity row.
        const result = handleReportUpdate(report.status, { type: 'queue' })
        const group = matchedByQueue.get(assignment.queueId) ?? []
        group.push({
          id: report.id,
          queueId: assignment.queueId,
          nextStatus: result.nextStatus,
          activity: result.activity,
        })
        matchedByQueue.set(assignment.queueId, group)
      } else {
        unmatchedIds.push(report.id)
      }

      if (report.id > maxReportId) maxReportId = report.id
    }

    // Bulk UPDATE matched reports — split by whether status should change.
    // handleReportUpdate returns nextStatus only for open → queued;
    // other statuses keep their current status but still get routed.
    for (const [queueId, group] of matchedByQueue) {
      const withTransition = group
        .filter((r) => r.nextStatus !== null)
        .map((r) => r.id)
      const withoutTransition = group
        .filter((r) => r.nextStatus === null)
        .map((r) => r.id)

      if (withTransition.length) {
        await this.db.db
          .updateTable('report')
          .set({ queueId, queuedAt: now, status: 'queued', updatedAt: now })
          .where('id', 'in', withTransition)
          .execute()
      }
      if (withoutTransition.length) {
        await this.db.db
          .updateTable('report')
          .set({ queueId, queuedAt: now, updatedAt: now })
          .where('id', 'in', withoutTransition)
          .execute()
      }
    }

    // Bulk UPDATE unmatched reports — status stays unchanged
    if (unmatchedIds.length) {
      await this.db.db
        .updateTable('report')
        .set({ queueId: -1, queuedAt: null, updatedAt: now })
        .where('id', 'in', unmatchedIds)
        .execute()
    }

    // Bulk INSERT activities for matched reports that changed status.
    if (opts?.serviceDid) {
      const withActivities = [...matchedByQueue.values()]
        .flat()
        .filter((r) => r.activity !== null)
      if (withActivities.length) {
        await this.db.db
          .insertInto('report_activity')
          .values(
            withActivities.map((r) => ({
              reportId: r.id,
              activityType: r.activity!.activityType,
              previousStatus: r.activity!.previousStatus,
              internalNote: null,
              publicNote: null,
              meta: null,
              isAutomated: true,
              createdBy: opts.serviceDid!,
              createdAt: now,
            })),
          )
          .execute()
      }
    }

    const assigned = [...matchedByQueue.values()].reduce(
      (sum, g) => sum + g.length,
      0,
    )

    return {
      processed: reports.length,
      assigned,
      unmatched: unmatchedIds.length,
      maxId: maxReportId,
    }
  }

  /**
   * Read newly-created modEventReport rows from `moderation_event` and
   * insert corresponding `report` rows with `queueId` already resolved.
   * Used by the queue-router daemon. Idempotent via `ON CONFLICT (eventId)
   * DO NOTHING` — safe to re-run on the same range.
   *
   * Even when no queues are configured, report rows are still inserted with
   * `queueId = -1` so the invariant "every modEventReport has a `report` row"
   * holds.
   */
  async insertReportsFromEvents(params: {
    cursor: number | null
    limit: number
  }): Promise<{
    processed: number
    assigned: number
    unmatched: number
    maxEventId: number
  }> {
    const { queues } = await this.list({ limit: 1000, enabled: true })

    let query = this.db.db
      .selectFrom('moderation_event')
      .select([
        'id',
        'subjectDid',
        'subjectUri',
        'subjectMessageId',
        'meta',
        'createdAt',
      ])
      .where('action', '=', MOD_EVENT_REPORT_ACTION)
      .orderBy('id', 'asc')
      .limit(params.limit)

    if (params.cursor !== null) {
      query = query.where('id', '>', params.cursor)
    }

    const events = await query.execute()

    if (!events.length) {
      return { processed: 0, assigned: 0, unmatched: 0, maxEventId: 0 }
    }

    const now = new Date().toISOString()
    let maxEventId = 0
    let assigned = 0
    let unmatched = 0

    const rows = events.map((event) => {
      const subjectType: SubjectType = event.subjectMessageId
        ? 'message'
        : event.subjectUri
          ? 'record'
          : 'account'

      let collection: string | null = null
      let recordPath = ''
      if (event.subjectUri) {
        const uri = new AtUri(event.subjectUri)
        collection = uri.collection
        recordPath = `${uri.collection}/${uri.rkey}`
      }

      const reportType =
        (event.meta?.reportType as string | undefined) ?? REASON_OTHER

      const assignment = resolveAssignment(
        subjectType,
        collection,
        reportType,
        queues,
        now,
      )

      if (assignment.queueId === -1) unmatched++
      else assigned++
      if (event.id > maxEventId) maxEventId = event.id

      const isMuted =
        !!event.meta?.isReporterMuted || !!event.meta?.isSubjectMuted

      return {
        eventId: event.id,
        queueId: assignment.queueId,
        queuedAt: assignment.queuedAt,
        actionEventIds: null,
        actionNote: null,
        isMuted,
        status: assignment.status,
        reportType,
        did: event.subjectDid,
        recordPath,
        subjectMessageId: event.subjectMessageId,
        createdAt: now,
        updatedAt: now,
      }
    })

    // ON CONFLICT (eventId) DO NOTHING covers any race where a report row
    // already exists for the event (e.g. transitional code paths or retries
    // after a crash mid-batch).
    await this.db.db
      .insertInto('report')
      .values(rows)
      .onConflict((oc) => oc.column('eventId').doNothing())
      .execute()

    // Activity rows are intentionally not emitted: a freshly-inserted report
    // has no prior state to "transition" from. Activity rows record state
    // changes, and being born already-queued is not a state change. This
    // matches `handleReportUpdate`'s design where activity is only emitted
    // on real transitions.

    return {
      processed: events.length,
      assigned,
      unmatched,
      maxEventId,
    }
  }
}

export function findMatchingQueue(
  queues: Selectable<ReportQueue>[],
  subjectType: string,
  collection: string | null,
  reportType: string | undefined,
): Selectable<ReportQueue> | null {
  if (!reportType) return null

  for (const queue of queues) {
    const subjectTypeMatch = queue.subjectTypes.includes(subjectType)
    const collectionMatch =
      subjectType === 'record' && queue.collection !== null
        ? (collection ?? null) === queue.collection
        : true
    const reportTypeMatch = queue.reportTypes.includes(reportType)

    if (subjectTypeMatch && collectionMatch && reportTypeMatch) {
      return queue
    }
  }

  return null
}
