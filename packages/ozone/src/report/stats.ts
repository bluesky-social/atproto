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

  /** Materialize all groups, refreshing stats if needed. */
  async materializeAll(opts?: { force?: boolean }): Promise<void> {
    try {
      const start = Date.now()
      const groups = await this.enumerateGroups()
      for (const group of groups) {
        try {
          await this.materializeGroup(group, opts)
        } catch (err) {
          dbLogger.error(
            { err, group },
            'error materializing report stats group',
          )
        }
      }
      const duration = Date.now() - start
      dbLogger.info({ duration }, 'report stats materialization completed')
    } catch (err) {
      dbLogger.error({ err }, 'report stats materialization errored')
    }
  }

  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const groups: ReportStatGroup[] = []

    // global
    groups.push({ queueId: -1, mode: 'live', timeframe: 'day' })
    groups.push({ queueId: -1, mode: 'fixed', timeframe: 'day' })

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
      const cached = await this.getLatestStats(group)
      if (cached && this.isGroupFresh(cached)) return cached
    }

    const stats = await this.computeGroup(group)
    const result = await this.updateGroup(group, stats)
    return result
  }

  private isGroupFresh(stats: Selectable<ReportStat>): boolean {
    const ttl =
      stats.mode === 'live'
        ? 15 * MINUTE
        : stats.timeframe === 'day'
          ? 24 * HOUR
          : 7 * 24 * HOUR
    const expiresAt = Date.now() - ttl
    const computedAt = new Date(stats.computedAt).getTime()
    return computedAt > expiresAt
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

    // pending
    let pendingQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('status', '=', 'open')
      .where('createdAt', '>', cutoff)
    if (queueId !== -1) {
      pendingQb = pendingQb.where('queueId', '=', queueId)
    }
    const pendingCount = (await pendingQb.executeTakeFirst())?.count ?? 0

    // inbound
    let inboundQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('createdAt', '>', cutoff)
    if (queueId !== -1) {
      inboundQb = inboundQb.where('queueId', '=', queueId)
    }
    const inboundCount = (await inboundQb.executeTakeFirst())?.count ?? 0

    // actioned
    let actionedQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('status', '=', 'closed')
      .where('updatedAt', '>', cutoff)
    if (queueId !== -1) {
      actionedQb = actionedQb.where('queueId', '=', queueId)
    }
    const actionedCount = (await actionedQb.executeTakeFirst())?.count ?? 0

    // escalated
    let escalatedQb = this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('count'))
      .where('status', '=', 'escalated')
      .where('updatedAt', '>', cutoff)
    if (queueId !== -1) {
      escalatedQb = escalatedQb.where('queueId', '=', queueId)
    }
    const escalatedCount = (await escalatedQb.executeTakeFirst())?.count ?? 0

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
      .orderBy('computedAt', 'desc')
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
