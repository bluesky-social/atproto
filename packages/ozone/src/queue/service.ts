import { Selectable, sql } from 'kysely'
import { ToolsOzoneQueueDefs } from '@atproto/api'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { TimeIdKeyset, paginate } from '../db/pagination'
import { ReportQueue } from '../db/schema/report_queue'
import { jsonb } from '../db/types'

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

  async getStatsForQueue(
    queueId: number,
  ): Promise<ToolsOzoneQueueDefs.QueueStats> {
    const row = await this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('queueId', '=', queueId)
      .where('periodType', '=', 'live')
      .executeTakeFirst()

    if (!row) {
      return {
        pendingCount: 0,
        actionedCount: 0,
        escalatedPendingCount: 0,
        lastUpdated: new Date().toISOString(),
      }
    }

    return {
      inboundCount: row.inboundCount,
      pendingCount: row.pendingCount,
      actionedCount: row.actionedCount,
      escalatedPendingCount: row.escalatedCount,
      actionRate: row.actionRate ?? undefined,
      lastUpdated: row.computedAt,
    }
  }

  view(queue: Selectable<ReportQueue>): ToolsOzoneQueueDefs.QueueView {
    // Synchronous view — stats will be populated via viewAsync when needed
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
        escalatedPendingCount: 0,
        lastUpdated: new Date().toISOString(),
      },
    }
  }

  async viewWithStats(
    queue: Selectable<ReportQueue>,
  ): Promise<ToolsOzoneQueueDefs.QueueView> {
    const view = this.view(queue)
    view.stats = await this.getStatsForQueue(queue.id)
    return view
  }

  /**
   * Assign a batch of reports.
   */
  async assignReportBatch(
    params:
      | { start: number; end: number; limit: number }
      | { cursor: number | null; limit: number },
    opts?: { includeUnmatched?: boolean },
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
      .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
      .select(['r.id', 'me.subjectUri', 'me.subjectMessageId', 'me.meta'])
      .orderBy('r.id', 'asc')
      .limit(params.limit)

    if (opts?.includeUnmatched) {
      query = query.where((qb) => {
        return qb.orWhere('r.queueId', 'is', null).orWhere('r.queueId', '=', -1)
      })
    } else {
      query = query.where('r.queueId', 'is', null)
    }

    if ('end' in params) {
      query = query
        .where('r.id', '>=', params.start)
        .where('r.id', '<=', params.end)
    } else {
      if (params.cursor !== null) {
        query = query.where('r.id', '>', params.cursor)
      }
    }

    const reports = await query.execute()

    if (!reports.length) {
      return { processed: 0, assigned: 0, unmatched: 0, maxId: 0 }
    }

    const now = new Date().toISOString()
    let assigned = 0
    let unassigned = 0
    let maxReportId = 0

    for (const report of reports) {
      const subjectType = report.subjectMessageId
        ? 'message'
        : report.subjectUri
          ? 'record'
          : 'account'

      let collection: string | null = null
      if (report.subjectUri) {
        try {
          collection = new AtUri(report.subjectUri).collection || null
        } catch {
          collection = null
        }
      }

      const reportType = (report.meta as Record<string, unknown> | null)
        ?.reportType as string | undefined

      const matchingQueue = findMatchingQueue(
        queues,
        subjectType,
        collection,
        reportType,
      )

      await this.db.db
        .updateTable('report')
        .set({
          queueId: matchingQueue?.id ?? -1,
          queuedAt: matchingQueue ? now : null,
          updatedAt: now,
        })
        .where('id', '=', report.id)
        .execute()

      if (matchingQueue) {
        assigned++
      } else {
        unassigned++
      }

      if (report.id > maxReportId) maxReportId = report.id
    }

    return {
      processed: reports.length,
      assigned,
      unmatched: unassigned,
      maxId: maxReportId,
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
