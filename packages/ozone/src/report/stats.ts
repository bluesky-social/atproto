import { Selectable, sql } from 'kysely'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import { Database } from '../db'
import { ReportStat } from '../db/schema/report_stat'
import { dbLogger } from '../logger'

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

export type ReportStatMode = 'live' | 'fixed'
const REPORT_STAT_LIVE_TTL = 15 * MINUTE
export type ReportStatTimeframe = 'day' | 'week'
export type ReportStatGroup = {
  queueId: number
  mode: ReportStatMode
  timeframe: ReportStatTimeframe
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

  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const groups: ReportStatGroup[] = []

    // global
    groups.push({
      queueId: -1,
      mode: 'live',
      timeframe: 'day',
      moderatorDid: null,
    })
    groups.push({
      queueId: -1,
      mode: 'fixed',
      timeframe: 'day',
      moderatorDid: null,
    })

    // per-queue
    const queues = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .execute()
    for (const queue of queues) {
      groups.push(
        {
          queueId: queue.id,
          mode: 'live',
          timeframe: 'day',
          moderatorDid: null,
        },
        {
          queueId: queue.id,
          mode: 'fixed',
          timeframe: 'day',
          moderatorDid: null,
        },
      )
    }

    // per-moderator
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
    for (const member of members) {
      groups.push({
        queueId: -1,
        mode: 'live',
        timeframe: 'day',
        moderatorDid: member.did,
      })
      groups.push({
        queueId: -1,
        mode: 'fixed',
        timeframe: 'day',
        moderatorDid: member.did,
      })
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

    return this.db.db
      .insertInto('report_stat')
      .values({
        queueId,
        mode,
        timeframe,
        moderatorDid,
        inboundCount: stats.inboundCount ?? null,
        pendingCount,
        actionedCount: stats.actionedCount ?? null,
        escalatedCount,
        actionRate,
        avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
        computedAt,
      })
      .onConflict((oc) =>
        oc
          .expression(sql`"queueId", "timeframe", COALESCE("moderatorDid", '')`)
          .where('mode', '=', 'live')
          .doUpdateSet({
            inboundCount: stats.inboundCount ?? null,
            pendingCount,
            actionedCount: stats.actionedCount ?? null,
            escalatedCount,
            actionRate,
            avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
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
    if (group.moderatorDid) {
      return this.computeModeratorStats(group)
    } else if (group.queueId === -1) {
      return this.computeAggregateStats(group)
    } else {
      return this.computeQueueGroup(group)
    }
  }
  private async computeAggregateStats(
    group: ReportStatGroup,
  ): Promise<AggregateStatistics> {
    const { timeframe } = group

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    let qb = this.db.db
      .selectFrom('report')
      .select([
        sql<number>`count(*)`.as('inboundCount'),
        sql<number>`count(*) filter (where "status" in ('open', 'queued'))`.as(
          'pendingCount',
        ),
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
    const pendingCount = row?.pendingCount ?? 0
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
  private async computeQueueGroup(
    group: ReportStatGroup,
  ): Promise<QueueStatistics> {
    const { queueId, timeframe } = group

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    let qb = this.db.db
      .selectFrom('report')
      .select([
        sql<number>`count(*)`.as('inboundCount'),
        sql<number>`count(*) filter (where "status" in ('open', 'queued'))`.as(
          'pendingCount',
        ),
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
    const pendingCount = row?.pendingCount ?? 0
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
  private async computeModeratorStats(
    group: ReportStatGroup,
  ): Promise<ModeratorStatistics> {
    const { timeframe, moderatorDid } = group

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    const row = await this.db.db
      .selectFrom('report as r')
      .select([
        sql<number>`count(*) filter (where exists (
          select 1 from moderation_event me
          where r."actionEventIds" @> jsonb_build_array(me.id)
          and me."createdBy" = ${moderatorDid}
          and me."createdAt" > ${cutoff}
        ))`.as('inboundCount'),
        sql<number>`count(*) filter (where r."status" = 'closed' and exists (
          select 1 from moderation_event me
          where r."actionEventIds" @> jsonb_build_array(me.id)
          and me."createdBy" = ${moderatorDid}
          and me."createdAt" > ${cutoff}
        ))`.as('actionedCount'),
        sql<number>`avg(extract(epoch from (r."closedAt"::timestamp - ma."startAt"::timestamp)) ) filter (where r."status" = 'closed' and r."closedAt" is not null and ma."startAt" is not null and exists (
          select 1 from moderation_event me
          where r."actionEventIds" @> jsonb_build_array(me.id)
          and me."createdBy" = ${moderatorDid}
          and me."createdAt" > ${cutoff}
        ))`.as('avgHandlingTimeSec'),
      ])
      .leftJoin('moderator_assignment as ma', (join) =>
        join.onRef('ma.reportId', '=', 'r.id').on('ma.did', '=', moderatorDid!),
      )
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
      .where('queueId', '=', group.queueId)
      .orderBy('computedAt', 'desc')
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
      queueId: queueId ?? -1,
      mode: 'live',
      timeframe: 'day',
      moderatorDid: null,
    })
  }

  /** Get live daily statistics for a moderator. */
  async getLiveModeratorStats(
    moderatorDid: string,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getLatestStats({
      queueId: -1,
      mode: 'live',
      timeframe: 'day',
      moderatorDid,
    })
  }
}
