import { Selectable, sql } from 'kysely'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import { Database } from '../db'
import { ReportStat } from '../db/schema/report_stat'
import { dbLogger } from '../logger'

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

export type ReportStatMode = 'live' | 'historical'
const REPORT_STAT_LIVE_TTL = 15 * MINUTE
export type ReportStatTimeframe = 'day' | 'week'
export type ReportStatGroup = {
  mode: ReportStatMode
  timeframe: ReportStatTimeframe
  queueId: number | null
  moderatorDid: string | null
}
export type QueueStatistics = {
  inboundCount: number
  pendingCount: number
  actionedCount: number
  escalatedCount: number
  actionRate: number
  avgHandlingTimeSec?: number
}
export type ModeratorStatistics = {
  inboundCount: number
  actionedCount: number
  avgHandlingTimeSec?: number
}
export type AggregateStatistics = {
  inboundCount: number
  pendingCount: number
  actionedCount: number
  escalatedCount: number
  actionRate: number
  avgHandlingTimeSec?: number
}
export type ReportStatistics =
  | QueueStatistics
  | ModeratorStatistics
  | AggregateStatistics

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

  /** List out groups to calculate, ordered by priority. */
  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const groups: ReportStatGroup[] = []

    // context
    const queues = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .execute()
    const members = await this.db.db
      .selectFrom('member')
      .select('did')
      .where('disabled', '=', false)
      .where('role', 'in', [
        'tools.ozone.team.defs#roleAdmin',
        'tools.ozone.team.defs#roleModerator',
        'tools.ozone.team.defs#roleTriage',
      ])
      .execute()

    // live
    /// aggregate
    groups.push({
      mode: 'live',
      timeframe: 'day',
      queueId: null,
      moderatorDid: null,
    })
    /// per-queue
    queues.map((queue) =>
      groups.push({
        mode: 'live',
        timeframe: 'day',
        queueId: queue.id,
        moderatorDid: null,
      }),
    )
    /// unqueued
    groups.push({
      mode: 'live',
      timeframe: 'day',
      queueId: -1,
      moderatorDid: null,
    })
    /// per-moderator
    members.map((member) =>
      groups.push({
        mode: 'live',
        timeframe: 'day',
        queueId: null,
        moderatorDid: member.did,
      }),
    )

    // historical
    /// aggregate
    groups.push({
      mode: 'historical',
      timeframe: 'day',
      queueId: null,
      moderatorDid: null,
    })
    /// per-queue
    queues.map((queue) =>
      groups.push({
        mode: 'historical',
        timeframe: 'day',
        queueId: queue.id,
        moderatorDid: null,
      }),
    )
    /// unqueued
    groups.push({
      mode: 'historical',
      timeframe: 'day',
      queueId: -1,
      moderatorDid: null,
    })
    /// per-moderator
    members.map((member) =>
      groups.push({
        mode: 'historical',
        timeframe: 'day',
        queueId: null,
        moderatorDid: member.did,
      }),
    )

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
        ? REPORT_STAT_LIVE_TTL
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
    const { queueId, mode, timeframe, moderatorDid } = group
    const computedAt = new Date().toISOString()

    const pendingCount =
      'pendingCount' in stats ? stats.pendingCount ?? null : null
    const escalatedCount =
      'escalatedCount' in stats ? stats.escalatedCount ?? null : null
    const actionRate = 'actionRate' in stats ? stats.actionRate ?? null : null

    // For live stats, delete the existing row first
    if (mode === 'live') {
      let del = this.db.db
        .deleteFrom('report_stat')
        .where('mode', '=', 'live')
        .where('timeframe', '=', timeframe)
      if (queueId !== null) {
        del = del.where('queueId', '=', queueId)
      } else {
        del = del.where('queueId', 'is', null)
      }
      if (moderatorDid) {
        del = del.where('moderatorDid', '=', moderatorDid)
      } else {
        del = del.where('moderatorDid', 'is', null)
      }
      await del.execute()
    }

    return this.db.db
      .insertInto('report_stat')
      .values({
        mode,
        timeframe,
        queueId,
        moderatorDid,
        inboundCount: stats.inboundCount ?? null,
        pendingCount,
        actionedCount: stats.actionedCount ?? null,
        escalatedCount,
        actionRate,
        avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
        computedAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  /** Calculate statistics for a group. */
  private async computeGroup(
    group: ReportStatGroup,
  ): Promise<ReportStatistics> {
    if (group.moderatorDid) {
      return this.computeModerator(group)
    } else if (group.queueId === null) {
      return this.computeAggregate(group)
    } else {
      return this.computeQueue(group)
    }
  }
  private async computeAggregate(
    group: ReportStatGroup,
  ): Promise<AggregateStatistics> {
    const { timeframe } = group

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    // all-time (sped up with an index)
    const pendingRow = await this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('pendingCount'))
      .where('status', '!=', 'closed')
      .executeTakeFirst()

    // windowed
    let qb = this.db.db
      .selectFrom('report')
      .select([
        sql<number>`count(*)`.as('inboundCount'),
        sql<number>`count(*) filter (where "status" = 'closed' and "updatedAt" > ${cutoff})`.as(
          'actionedCount',
        ),
        sql<number>`count(*) filter (where "status" = 'escalated' and "updatedAt" > ${cutoff})`.as(
          'escalatedCount',
        ),
        sql<number>`avg(extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp)) ) filter (where "status" = 'closed' and "closedAt" is not null and "updatedAt" > ${cutoff})`.as(
          'avgHandlingTimeSec',
        ),
      ])
      .where('createdAt', '>', cutoff)

    const row = await qb.executeTakeFirst()
    const inboundCount = row?.inboundCount ?? 0
    const pendingCount = pendingRow?.pendingCount ?? 0
    const actionedCount = row?.actionedCount ?? 0
    const escalatedCount = row?.escalatedCount ?? 0
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec = row?.avgHandlingTimeSec
      ? Math.round(row.avgHandlingTimeSec)
      : undefined

    return {
      inboundCount,
      pendingCount,
      actionedCount,
      escalatedCount,
      actionRate,
      avgHandlingTimeSec,
    }
  }
  private async computeQueue(group: ReportStatGroup): Promise<QueueStatistics> {
    const { queueId, timeframe } = group
    if (queueId === null) {
      throw new Error('Queue ID is required for queue stats')
    }

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    // all-time (sped up with an index)
    const pendingRow = await this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('pendingCount'))
      .where('status', '!=', 'closed')
      .where('queueId', '=', queueId)
      .executeTakeFirst()

    // windowed
    let qb = this.db.db
      .selectFrom('report')
      .select([
        sql<number>`count(*)`.as('inboundCount'),
        sql<number>`count(*) filter (where "status" = 'closed' and "updatedAt" > ${cutoff})`.as(
          'actionedCount',
        ),
        sql<number>`count(*) filter (where "status" = 'escalated' and "updatedAt" > ${cutoff})`.as(
          'escalatedCount',
        ),
        sql<number>`avg(extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp)) ) filter (where "status" = 'closed' and "closedAt" is not null and "updatedAt" > ${cutoff})`.as(
          'avgHandlingTimeSec',
        ),
      ])
      .where('createdAt', '>', cutoff)
      .where('queueId', '=', queueId)

    const row = await qb.executeTakeFirst()
    const inboundCount = row?.inboundCount ?? 0
    const pendingCount = pendingRow?.pendingCount ?? 0
    const actionedCount = row?.actionedCount ?? 0
    const escalatedCount = row?.escalatedCount ?? 0
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec = row?.avgHandlingTimeSec
      ? Math.round(row.avgHandlingTimeSec)
      : undefined

    return {
      inboundCount,
      pendingCount,
      actionedCount,
      escalatedCount,
      actionRate,
      avgHandlingTimeSec,
    }
  }
  private async computeModerator(
    group: ReportStatGroup,
  ): Promise<ModeratorStatistics> {
    const { timeframe, moderatorDid } = group

    if (!moderatorDid) {
      throw new Error('Moderator DID is required for moderator stats')
    }

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    const row = await this.db.db
      .selectFrom('report as r')
      .innerJoin('moderator_assignment as ma', (join) =>
        join
          .onRef('ma.reportId', '=', 'r.id')
          .on('ma.did', '=', moderatorDid)
          .on('ma.endAt', 'is', null),
      )
      .select([
        sql<number>`count(*)`.as('inboundCount'),
        sql<number>`count(*) filter (where r."status" = 'closed')`.as(
          'actionedCount',
        ),
        sql<number>`avg(extract(epoch from (r."closedAt"::timestamp - ma."startAt"::timestamp)) ) filter (where r."status" = 'closed' and r."closedAt" is not null)`.as(
          'avgHandlingTimeSec',
        ),
      ])
      .where('r.createdAt', '>', cutoff)
      .executeTakeFirst()

    const inboundCount = row?.inboundCount ?? 0
    const actionedCount = row?.actionedCount ?? 0
    const avgHandlingTimeSec = row?.avgHandlingTimeSec
      ? Math.round(row.avgHandlingTimeSec)
      : undefined

    return {
      inboundCount,
      actionedCount,
      avgHandlingTimeSec,
    }
  }

  private async getLatestStats(
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('mode', '=', group.mode)
      .where('timeframe', '=', group.timeframe)
      .orderBy('computedAt', 'desc')
    if (group.queueId !== null) {
      qb = qb.where('queueId', '=', group.queueId)
    } else {
      qb = qb.where('queueId', 'is', null)
    }
    if (group.moderatorDid) {
      qb = qb.where('moderatorDid', '=', group.moderatorDid)
    } else {
      qb = qb.where('moderatorDid', 'is', null)
    }

    return qb.executeTakeFirst()
  }

  /** Get live daily statistics for a queue. */
  async getLiveQueueStats(
    queueId?: number,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getLatestStats({
      mode: 'live',
      timeframe: 'day',
      queueId: queueId ?? null,
      moderatorDid: null,
    })
  }

  /** Get live daily statistics for a moderator. */
  async getLiveModeratorStats(
    moderatorDid: string,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getLatestStats({
      mode: 'live',
      timeframe: 'day',
      queueId: null,
      moderatorDid,
    })
  }
}
