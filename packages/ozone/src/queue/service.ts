import { Selectable, sql } from 'kysely'
import { ToolsOzoneQueueDefs } from '@atproto/api'
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
    let qb = this.db.db.selectFrom('report_queue').selectAll()

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
    createdBy,
  }: {
    name: string
    subjectTypes: string[]
    collection?: string | null
    reportTypes: string[]
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
      .executeTakeFirst()
  }

  async update(
    id: number,
    updates: { name?: string; enabled?: boolean },
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
    await this.db.db.deleteFrom('report_queue').where('id', '=', id).execute()
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
    let qb = this.db.db.selectFrom('report_queue').selectAll()

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

  // @TODO: implement later
  emptyStats(): ToolsOzoneQueueDefs.QueueStats {
    return {
      pendingCount: 0,
      actionedCount: 0,
      escalatedPendingCount: 0,
      lastUpdated: new Date().toISOString(),
    }
  }

  view(queue: Selectable<ReportQueue>): ToolsOzoneQueueDefs.QueueView {
    return {
      id: queue.id,
      name: queue.name,
      subjectTypes: queue.subjectTypes,
      collection: queue.collection ?? undefined,
      reportTypes: queue.reportTypes,
      createdBy: queue.createdBy,
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
      enabled: queue.enabled,
      stats: this.emptyStats(),
    }
  }
}
