import { Selectable, sql } from 'kysely'
import { Database } from '../db'
import { dbLogger } from '../logger'
import {
  ReportStat,
  ReportStatMode,
  ReportStatTimeframe,
} from '../db/schema/report_stat'
import { DAY } from '@atproto/common'

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

type QueueCounts = Map<
  number | null,
  {
    inboundCount: number
    pendingCount: number
    actionedCount: number
    escalatedCount: number
  }
>

export class ReportStatsService {
  constructor(public db: Database) {}

  static creator(): ReportStatsServiceCreator {
    return (db: Database) => new ReportStatsService(db)
  }

  async computeAll(): Promise<void> {
    try {
      const start = Date.now()
      await this.computeLiveStats()
      await this.computeDailyStats()
      const duration = Date.now() - start
      dbLogger.info(
        { durationMs: duration },
        'report stats computation completed',
      )
    } catch (err) {
      dbLogger.error({ err }, 'report stats computation errored')
    }
  }

  async computeLiveStats(): Promise<void> {
    await this.computeAndUpsert('live', 'day')
  }

  async computeDailyStats(): Promise<void> {
    // Check if up to date
    const existing = await this.db.db
      .selectFrom('report_stat')
      .select('computedAt')
      .where('mode', '=', 'fixed')
      .where('timeframe', '=', 'day')
      .orderBy('computedAt', 'desc')
      .executeTakeFirst()
    const lastComputed = new Date(existing?.computedAt || 0).getTime()
    const isUpToDate = lastComputed > Date.now() - DAY
    if (isUpToDate) return

    await this.computeAndUpsert('fixed', 'day')
    dbLogger.info('daily report stats refreshed')
  }

  /**
   * Shared computation logic for both live and daily stats.
   * Queries the report table, aggregates counts per queue + overall,
   * and upserts into report_stat.
   */
  private async computeAndUpsert(
    mode: ReportStatMode,
    timeframe: ReportStatTimeframe,
  ): Promise<void> {
    const counts = await this.queryReportCounts()
    const now = new Date().toISOString()

    for (const [queueId, stats] of counts) {
      const actionRate =
        stats.inboundCount > 0
          ? Math.round((stats.actionedCount / stats.inboundCount) * 100)
          : null

      await sql`
        INSERT INTO report_stat ("queueId", "mode", "timeframe", "inboundCount", "pendingCount", "actionedCount", "escalatedCount", "actionRate", "computedAt")
        VALUES (${queueId}, ${mode}, ${timeframe}, ${stats.inboundCount}, ${stats.pendingCount}, ${stats.actionedCount}, ${stats.escalatedCount}, ${actionRate}, ${now})
        ON CONFLICT (COALESCE("queueId", -1), "timeframe") WHERE "mode" = 'live'
        DO UPDATE SET
          "inboundCount" = EXCLUDED."inboundCount",
          "pendingCount" = EXCLUDED."pendingCount",
          "actionedCount" = EXCLUDED."actionedCount",
          "escalatedCount" = EXCLUDED."escalatedCount",
          "actionRate" = EXCLUDED."actionRate",
          "computedAt" = EXCLUDED."computedAt"
      `.execute(this.db.db)
    }
  }

  /**
   * Query the report table for all stat counts, grouped by queueId.
   * Returns a Map of queueId → counts, plus a null key for aggregate.
   */
  private async queryReportCounts(): Promise<QueueCounts> {
    const cutoff = new Date(Date.now() - DAY).toISOString()

    // Pending counts (all time) per queue
    const pendingRows = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<string>`count(*)`.as('cnt')])
      .where('status', '=', 'open')
      .groupBy('queueId')
      .execute()

    // Inbound (last 24h) per queue
    const inboundRows = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<string>`count(*)`.as('cnt')])
      .where('createdAt', '>', cutoff)
      .groupBy('queueId')
      .execute()

    // Actioned (last 24h) per queue
    const actionedRows = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<string>`count(*)`.as('cnt')])
      .where('status', '=', 'closed')
      .where('updatedAt', '>', cutoff)
      .groupBy('queueId')
      .execute()

    // Escalated (last 24h) per queue
    const escalatedRows = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<string>`count(*)`.as('cnt')])
      .where('status', '=', 'escalated')
      .where('updatedAt', '>', cutoff)
      .groupBy('queueId')
      .execute()

    // Collect all queue IDs that appear in any query, excluding NULL and -1
    // (those are unqueued reports, included in aggregate only)
    const activeQueueIds = await this.db.db
      .selectFrom('report_queue')
      .select('id')
      .where('deletedAt', 'is', null)
      .execute()

    const queueIds = new Set(activeQueueIds.map((r) => r.id))

    // Build per-queue counts
    const counts: QueueCounts = new Map()

    // Initialize all active queues with zeros
    for (const id of queueIds) {
      counts.set(id, {
        inboundCount: 0,
        pendingCount: 0,
        actionedCount: 0,
        escalatedCount: 0,
      })
    }

    // Fill in pending counts
    for (const row of pendingRows) {
      const qid = row.queueId
      if (qid !== null && qid !== -1 && counts.has(qid)) {
        counts.get(qid)!.pendingCount = Number(row.cnt)
      }
    }

    // Fill in inbound counts
    for (const row of inboundRows) {
      const qid = row.queueId
      if (qid !== null && qid !== -1 && counts.has(qid)) {
        counts.get(qid)!.inboundCount = Number(row.cnt)
      }
    }

    // Fill in actioned counts
    for (const row of actionedRows) {
      const qid = row.queueId
      if (qid !== null && qid !== -1 && counts.has(qid)) {
        counts.get(qid)!.actionedCount = Number(row.cnt)
      }
    }

    // Fill in escalated counts
    for (const row of escalatedRows) {
      const qid = row.queueId
      if (qid !== null && qid !== -1 && counts.has(qid)) {
        counts.get(qid)!.escalatedCount = Number(row.cnt)
      }
    }

    // Compute aggregate (sum of all per-queue + unqueued reports)
    const aggregate = {
      inboundCount: 0,
      pendingCount: 0,
      actionedCount: 0,
      escalatedCount: 0,
    }

    // Sum per-queue counts
    for (const stats of counts.values()) {
      aggregate.inboundCount += stats.inboundCount
      aggregate.pendingCount += stats.pendingCount
      aggregate.actionedCount += stats.actionedCount
      aggregate.escalatedCount += stats.escalatedCount
    }

    // Add unqueued reports (queueId IS NULL or -1) to aggregate
    for (const row of pendingRows) {
      if (row.queueId === null || row.queueId === -1) {
        aggregate.pendingCount += Number(row.cnt)
      }
    }
    for (const row of inboundRows) {
      if (row.queueId === null || row.queueId === -1) {
        aggregate.inboundCount += Number(row.cnt)
      }
    }
    for (const row of actionedRows) {
      if (row.queueId === null || row.queueId === -1) {
        aggregate.actionedCount += Number(row.cnt)
      }
    }
    for (const row of escalatedRows) {
      if (row.queueId === null || row.queueId === -1) {
        aggregate.escalatedCount += Number(row.cnt)
      }
    }

    counts.set(null, aggregate)
    return counts
  }

  async getLiveStats(
    queueId?: number,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('mode', '=', 'live')
      .where('timeframe', '=', 'day')

    if (queueId !== undefined) {
      qb = qb.where('queueId', '=', queueId)
    }

    return qb.executeTakeFirst()
  }
}
