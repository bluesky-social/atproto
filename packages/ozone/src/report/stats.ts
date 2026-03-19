import { Selectable, sql } from 'kysely'
import { Database } from '../db'
import { dbLogger } from '../logger'
import { ReportStat } from '../db/schema/report_stat'
import { DAY, HOUR, MINUTE } from '@atproto/common'

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

export type ReportStatMode = 'live' | 'fixed'
export type ReportStatTimeframe = 'day' | 'week'
export type ReportStatGroup = {
  queueId: number
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

  /** Materialize each group, refreshing stats if needed. */
  async materializeAll(opts?: { force?: boolean }): Promise<void> {
    try {
      const start = Date.now()
      const groups = await this.enumerateGroups()
      await Promise.allSettled(
        groups.map((group) => this.materializeGroup(group, opts)),
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
    groups.push({ queueId: -1, mode: 'live', timeframe: 'day' })

    return groups
  }

  /**
   * Compute statistics for a group if needed.
   */
  private async materializeGroup(
    group: ReportStatGroup,
    opts?: { force?: boolean },
  ): Promise<Selectable<ReportStat>> {
    if (!opts?.force) {
      // check if up to date
      const cached = await this.getLatestStats(group)
      const ttl =
        group.mode === 'live'
          ? 15 * MINUTE
          : group.timeframe === 'day'
            ? 24 * HOUR
            : 7 * 24 * HOUR
      const expiresAt = Date.now() - ttl
      const computedAt = new Date(cached?.computedAt || 0).getTime()
      if (cached && computedAt > expiresAt) return cached
    }

    const stats = await this.computeGroup(group)
    return await this.updateGroup(group, stats)
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

    if (group.mode === 'live') {
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
          oc
            .columns(['queueId', 'timeframe'])
            .where('mode', '=', 'live')
            .doUpdateSet({
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
    } else {
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
        .returningAll()
        .executeTakeFirstOrThrow()
    }
  }

  /** Calculate statistics for a group. */
  private async computeGroup(
    group: ReportStatGroup,
  ): Promise<ReportStatistics> {
    const { queueId, timeframe } = group

    const timestamp =
      timeframe === 'day'
        ? Date.now() - DAY
        : timeframe === 'week'
          ? Date.now() - 7 * DAY
          : 0
    const cutoff = new Date(timestamp).toISOString()

    // pending (all time)
    let pendingQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('cnt'))
      .where('status', '=', 'open')
    if (queueId !== -1) {
      pendingQb = pendingQb.where('queueId', '=', queueId)
    }
    const pendingCount = (await pendingQb.executeTakeFirst())?.cnt ?? 0

    // inbound
    let inboundQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('cnt'))
      .where('createdAt', '>', cutoff)
    if (queueId !== -1) {
      inboundQb = inboundQb.where('queueId', '=', queueId)
    }
    const inboundCount = (await inboundQb.executeTakeFirst())?.cnt ?? 0

    // actioned
    let actionedQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('cnt'))
      .where('status', '=', 'closed')
      .where('updatedAt', '>', cutoff)
    if (queueId !== -1) {
      actionedQb = actionedQb.where('queueId', '=', queueId)
    }
    const actionedCount = (await actionedQb.executeTakeFirst())?.cnt ?? 0

    // escalated
    let escalatedQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('cnt'))
      .where('status', '=', 'escalated')
      .where('updatedAt', '>', cutoff)
    if (queueId !== -1) {
      escalatedQb = escalatedQb.where('queueId', '=', queueId)
    }
    const escalatedCount = (await escalatedQb.executeTakeFirst())?.cnt ?? 0

    // action rate
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0

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
    qb = qb.where('queueId', '=', group.queueId)

    return qb.executeTakeFirst()
  }

  /** Get daily report statistics for a queue. */
  async getLiveStats(
    queueId?: number,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getLatestStats({
      queueId: queueId ?? -1,
      mode: 'live',
      timeframe: 'day',
    })
  }
}
