import { Selectable, sql } from 'kysely'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ReportStat } from '../db/schema/report_stat'
import { DAY, HOUR, MINUTE } from '@atproto/common'

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

export type ReportStatMode = 'live' | 'fixed'
export type ReportStatTimeframe = 'day' | 'week'
export type ReportStatGroup = {
  queueId?: number
  mode: ReportStatMode
  timeframe: ReportStatTimeframe
}
export type ReportStatistics = {
  inboundCount: number
  pendingCount: number
  actionedCount: number
  escalatedCount: number
  actionRate: number | null
}

export class ReportStatsService {
  constructor(public db: Database) {}

  static creator(): ReportStatsServiceCreator {
    return (db: Database) => new ReportStatsService(db)
  }

  async materializeAll(): Promise<void> {
    try {
      const start = Date.now()
      const groups = await this.enumerateGroups()
      await Promise.allSettled(
        groups.map((group) => this.materializeGroup(group)),
      )
      const duration = Date.now() - start
      dbLogger.info({ duration }, 'report stats materialization completed')
    } catch (err) {
      dbLogger.error({ err }, 'report stats materialization errored')
    }
  }

  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const groups: ReportStatGroup[] = []

    // per-queue
    const queues = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .execute()
    for (const queue of queues) {
      groups.push(
        { queueId: queue.id, mode: 'live', timeframe: 'day' },
        { queueId: queue.id, mode: 'fixed', timeframe: 'day' },
      )
    }

    // global
    groups.push({ queueId: undefined, mode: 'live', timeframe: 'day' })

    return groups
  }

  /**
   * Compute statistics for a group if needed.
   */
  private async materializeGroup(
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat>> {
    const cached = await this.getLatestStats(group)

    // check if up to date
    /// live stats TTL: 15 minutes
    /// fixed stats TTL: whatever their timeframe is
    const ttl =
      group.mode === 'live'
        ? 15 * MINUTE
        : group.timeframe === 'day'
          ? 24 * HOUR
          : 7 * 24 * HOUR
    const isUpToDate =
      cached && new Date(cached.computedAt).getTime() > Date.now() - ttl

    if (isUpToDate) {
      return cached
    } else {
      const stats = await this.computeGroup(group)
      return await this.updateGroup(group, stats)
    }
  }

  private async updateGroup(
    group: ReportStatGroup,
    stats: ReportStatistics,
  ): Promise<Selectable<ReportStat>> {
    const { queueId, mode, timeframe } = group
    const {
      inboundCount,
      pendingCount,
      actionedCount,
      escalatedCount,
      actionRate,
    } = stats

    const computedAt = new Date().toISOString()
    return this.db.db
      .insertInto('report_stat')
      .values({
        queueId,
        mode,
        timeframe,
        inboundCount,
        pendingCount,
        actionedCount,
        escalatedCount,
        actionRate,
        computedAt,
      })
      .onConflict((oc) =>
        oc.columns(['queueId', 'mode', 'timeframe']).doUpdateSet({
          inboundCount,
          pendingCount,
          actionedCount,
          escalatedCount,
          actionRate,
          computedAt,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  /** Calculate statistics for a group. */
  private async computeGroup(
    group: ReportStatGroup,
  ): Promise<ReportStatistics> {
    const { queueId, mode, timeframe } = group

    const timestamp =
      timeframe === 'day'
        ? Date.now() - DAY
        : timeframe === 'week'
          ? Date.now() - 7 * DAY
          : 0
    const cutoff = new Date(timestamp).toISOString()

    // pending (all time)
    const pendingQuery = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<number>`count(*)`.as('cnt')])
      .where('status', '=', 'open')
    if (queueId !== undefined) {
      pendingQuery.where('queueId', '=', queueId)
    }
    const pendingCount = (await pendingQuery.executeTakeFirst())?.cnt ?? 0

    // inbound
    const inboundQuery = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<number>`count(*)`.as('cnt')])
      .where('createdAt', '>', cutoff)
    if (queueId !== undefined) {
      inboundQuery.where('queueId', '=', queueId)
    }
    const inboundCount = (await inboundQuery.executeTakeFirst())?.cnt ?? 0

    // actioned
    const actionedQuery = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<number>`count(*)`.as('cnt')])
      .where('status', '=', 'closed')
      .where('updatedAt', '>', cutoff)
    if (queueId !== undefined) {
      actionedQuery.where('queueId', '=', queueId)
    }
    const actionedCount = (await actionedQuery.executeTakeFirst())?.cnt ?? 0

    // escalated
    const escalatedQuery = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<number>`count(*)`.as('cnt')])
      .where('status', '=', 'escalated')
      .where('updatedAt', '>', cutoff)
    if (queueId !== undefined) {
      escalatedQuery.where('queueId', '=', queueId)
    }
    const escalatedCount = (await escalatedQuery.executeTakeFirst())?.cnt ?? 0

    // action rate
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : null

    return {
      inboundCount,
      pendingCount,
      actionedCount,
      escalatedCount,
      actionRate,
    }
  }

  /** Get latest statistics for a group. */
  private async getLatestStats(
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('mode', '=', group.mode)
      .where('timeframe', '=', group.timeframe)
    if (group.queueId !== undefined) {
      qb = qb.where('queueId', '=', group.queueId)
    }

    return qb.executeTakeFirst()
  }

  /** Get daily report statistics for a queue. */
  async getLiveStats(
    queueId?: number,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getLatestStats({
      queueId,
      mode: 'live',
      timeframe: 'day',
    })
  }
}
