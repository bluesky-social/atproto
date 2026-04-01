import { Selectable, sql } from 'kysely'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import { Database } from '../db'
import { ComputedAtIdKeyset, paginate } from '../db/pagination'
import { ReportStat } from '../db/schema/report_stat'
import { jsonb } from '../db/types'
import { dbLogger } from '../logger'

/**
 * Grouped report types. Stats are computed per group rather than per individual report type.
 */
export const REPORT_TYPE_GROUPS: Record<string, string[]> = {
  Legacy: [
    'com.atproto.moderation.defs#reasonSpam',
    'com.atproto.moderation.defs#reasonViolation',
    'com.atproto.moderation.defs#reasonMisleading',
    'com.atproto.moderation.defs#reasonSexual',
    'com.atproto.moderation.defs#reasonRude',
    'com.atproto.moderation.defs#reasonOther',
    'com.atproto.moderation.defs#reasonAppeal',
  ],
  Appeal: ['tools.ozone.report.defs#reasonAppeal'],
  Violence: [
    'tools.ozone.report.defs#reasonViolenceAnimalWelfare',
    'tools.ozone.report.defs#reasonViolenceThreats',
    'tools.ozone.report.defs#reasonViolenceGraphicContent',
    'tools.ozone.report.defs#reasonViolenceSelfHarm',
    'tools.ozone.report.defs#reasonViolenceGlorification',
    'tools.ozone.report.defs#reasonViolenceExtremistContent',
    'tools.ozone.report.defs#reasonViolenceTrafficking',
    'tools.ozone.report.defs#reasonViolenceOther',
  ],
  Sexual: [
    'tools.ozone.report.defs#reasonSexualAbuseContent',
    'tools.ozone.report.defs#reasonSexualNCII',
    'tools.ozone.report.defs#reasonSexualSextortion',
    'tools.ozone.report.defs#reasonSexualDeepfake',
    'tools.ozone.report.defs#reasonSexualAnimal',
    'tools.ozone.report.defs#reasonSexualUnlabeled',
    'tools.ozone.report.defs#reasonSexualOther',
  ],
  'Child Safety': [
    'tools.ozone.report.defs#reasonChildSafetyCSAM',
    'tools.ozone.report.defs#reasonChildSafetyGroom',
    'tools.ozone.report.defs#reasonChildSafetyMinorPrivacy',
    'tools.ozone.report.defs#reasonChildSafetyEndangerment',
    'tools.ozone.report.defs#reasonChildSafetyHarassment',
    'tools.ozone.report.defs#reasonChildSafetyPromotion',
    'tools.ozone.report.defs#reasonChildSafetyOther',
  ],
  Harassment: [
    'tools.ozone.report.defs#reasonHarassmentTroll',
    'tools.ozone.report.defs#reasonHarassmentTargeted',
    'tools.ozone.report.defs#reasonHarassmentHateSpeech',
    'tools.ozone.report.defs#reasonHarassmentDoxxing',
    'tools.ozone.report.defs#reasonHarassmentOther',
  ],
  Misleading: [
    'tools.ozone.report.defs#reasonMisleadingBot',
    'tools.ozone.report.defs#reasonMisleadingImpersonation',
    'tools.ozone.report.defs#reasonMisleadingSpam',
    'tools.ozone.report.defs#reasonMisleadingScam',
    'tools.ozone.report.defs#reasonMisleadingSyntheticContent',
    'tools.ozone.report.defs#reasonMisleadingMisinformation',
    'tools.ozone.report.defs#reasonMisleadingOther',
  ],
  'Rule Violations': [
    'tools.ozone.report.defs#reasonRuleSiteSecurity',
    'tools.ozone.report.defs#reasonRuleStolenContent',
    'tools.ozone.report.defs#reasonRuleProhibitedSales',
    'tools.ozone.report.defs#reasonRuleBanEvasion',
    'tools.ozone.report.defs#reasonRuleOther',
  ],
  Civic: [
    'tools.ozone.report.defs#reasonCivicElectoralProcess',
    'tools.ozone.report.defs#reasonCivicDisclosure',
    'tools.ozone.report.defs#reasonCivicInterference',
    'tools.ozone.report.defs#reasonCivicMisinformation',
    'tools.ozone.report.defs#reasonCivicImpersonation',
  ],
}

const REPORT_STAT_LIVE_TTL = 15 * MINUTE

export type ReportStatsServiceCreator = (db: Database) => ReportStatsService

export type ReportStatMode = 'live' | 'historical'
export type ReportStatTimeframe = 'day' | 'week'
export type ReportStatGroup = {
  mode: ReportStatMode
  timeframe: ReportStatTimeframe
  queueId: number | null
  moderatorDid: string | null
  reportTypes: string[] | null
}
export type AggregateStatistics = {
  inboundCount: number
  pendingCount: number
  actionedCount: number
  escalatedCount: number
  actionRate: number
  avgHandlingTimeSec?: number
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
export type ReportTypeStatistics = {
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
  | ReportTypeStatistics

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
      reportTypes: null,
    })
    /// per queue
    queues.map((queue) =>
      groups.push({
        mode: 'live',
        timeframe: 'day',
        queueId: queue.id,
        moderatorDid: null,
        reportTypes: null,
      }),
    )
    /// unqueued
    groups.push({
      mode: 'live',
      timeframe: 'day',
      queueId: -1,
      moderatorDid: null,
      reportTypes: null,
    })
    /// per moderator
    members.map((member) =>
      groups.push({
        mode: 'live',
        timeframe: 'day',
        queueId: null,
        moderatorDid: member.did,
        reportTypes: null,
      }),
    )
    /// per report type group
    for (const groupTypes of Object.values(REPORT_TYPE_GROUPS)) {
      groups.push({
        mode: 'live',
        timeframe: 'day',
        queueId: null,
        moderatorDid: null,
        reportTypes: groupTypes,
      })
    }

    // historical
    /// aggregate
    groups.push({
      mode: 'historical',
      timeframe: 'day',
      queueId: null,
      moderatorDid: null,
      reportTypes: null,
    })
    /// per queue
    queues.map((queue) =>
      groups.push({
        mode: 'historical',
        timeframe: 'day',
        queueId: queue.id,
        moderatorDid: null,
        reportTypes: null,
      }),
    )
    /// unqueued
    groups.push({
      mode: 'historical',
      timeframe: 'day',
      queueId: -1,
      moderatorDid: null,
      reportTypes: null,
    })
    /// per moderator
    members.map((member) =>
      groups.push({
        mode: 'historical',
        timeframe: 'day',
        queueId: null,
        moderatorDid: member.did,
        reportTypes: null,
      }),
    )
    /// per report type group
    for (const groupTypes of Object.values(REPORT_TYPE_GROUPS)) {
      groups.push({
        mode: 'historical',
        timeframe: 'day',
        queueId: null,
        moderatorDid: null,
        reportTypes: groupTypes,
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
      const cached = await this.getLiveStats(group)
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
    const { queueId, mode, timeframe, moderatorDid, reportTypes } = group
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
      if (reportTypes !== null) {
        del = del.where(
          sql`"reportTypes"::jsonb = ${jsonb(reportTypes)}::jsonb`,
        )
      } else {
        del = del.where('reportTypes', 'is', null)
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
        reportTypes: reportTypes !== null ? jsonb(reportTypes) : null,
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
    // validation
    const filters = [
      group.queueId,
      group.moderatorDid,
      group.reportTypes,
    ].filter((x) => x !== null)
    if (filters.length > 1) {
      throw new Error(
        'Only one of queueId, moderatorDid, or reportTypes can be set',
      )
    }

    // compute
    if (group.moderatorDid) {
      return this.computeModerator(group)
    } else if (group.reportTypes !== null && group.queueId === null) {
      return this.computeReportType(group)
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

    const allTime = await this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('pendingCount'))
      .where('status', '!=', 'closed')
      .executeTakeFirst()

    const createdAt = await this.db.db
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
      .executeTakeFirst()

    const inboundCount = createdAt?.inboundCount ?? 0
    const pendingCount = allTime?.pendingCount ?? 0
    const actionedCount = createdAt?.actionedCount ?? 0
    const escalatedCount = createdAt?.escalatedCount ?? 0
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec = createdAt?.avgHandlingTimeSec
      ? Math.round(createdAt.avgHandlingTimeSec)
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

    const allTime = await this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('pendingCount'))
      .where('status', '!=', 'closed')
      .where('queueId', '=', queueId)
      .executeTakeFirst()

    const createdAt = await this.db.db
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
      .executeTakeFirst()

    const inboundCount = createdAt?.inboundCount ?? 0
    const pendingCount = allTime?.pendingCount ?? 0
    const actionedCount = createdAt?.actionedCount ?? 0
    const escalatedCount = createdAt?.escalatedCount ?? 0
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec = createdAt?.avgHandlingTimeSec
      ? Math.round(createdAt.avgHandlingTimeSec)
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
  private async computeReportType(
    group: ReportStatGroup,
  ): Promise<ReportTypeStatistics> {
    const { timeframe, reportTypes } = group
    if (reportTypes === null) {
      throw new Error('Report types are required for report type stats')
    }

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    const allTime = await this.db.db
      .selectFrom('report')
      .select(sql<number>`count(*)`.as('pendingCount'))
      .where('status', '!=', 'closed')
      .where('reportType', 'in', reportTypes)
      .executeTakeFirst()

    const createdAt = await this.db.db
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
      .where('reportType', 'in', reportTypes)
      .executeTakeFirst()

    const inboundCount = createdAt?.inboundCount ?? 0
    const pendingCount = allTime?.pendingCount ?? 0
    const actionedCount = createdAt?.actionedCount ?? 0
    const escalatedCount = createdAt?.escalatedCount ?? 0
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec = createdAt?.avgHandlingTimeSec
      ? Math.round(createdAt.avgHandlingTimeSec)
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
    const { timeframe, moderatorDid, reportTypes } = group

    if (!moderatorDid) {
      throw new Error('Moderator DID is required for moderator stats')
    }

    const timestamp =
      timeframe === 'week' ? Date.now() - 7 * DAY : Date.now() - DAY
    const cutoff = new Date(timestamp).toISOString()

    let qb = this.db.db
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
    if (reportTypes !== null) {
      qb = qb.where('r.reportType', 'in', reportTypes)
    }
    const createdAt = await qb.executeTakeFirst()

    const inboundCount = createdAt?.inboundCount ?? 0
    const actionedCount = createdAt?.actionedCount ?? 0
    const avgHandlingTimeSec = createdAt?.avgHandlingTimeSec
      ? Math.round(createdAt.avgHandlingTimeSec)
      : undefined

    return {
      inboundCount,
      actionedCount,
      avgHandlingTimeSec,
    }
  }

  async getLiveStats(
    group: Omit<ReportStatGroup, 'mode'>,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('mode', '=', 'live')
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
    if (group.reportTypes !== null) {
      qb = qb.where(
        sql`"reportTypes"::jsonb = ${jsonb(group.reportTypes)}::jsonb`,
      )
    } else {
      qb = qb.where('reportTypes', 'is', null)
    }

    return qb.executeTakeFirst()
  }

  async getHistoricalStats(opts: {
    group: Omit<ReportStatGroup, 'mode'>
    startDate?: string
    endDate?: string
    limit: number
    cursor?: string
  }): Promise<{ stats: Selectable<ReportStat>[]; cursor?: string }> {
    const { group, startDate, endDate, limit } = opts
    const { queueId, moderatorDid, reportTypes, timeframe } = group
    const { ref } = this.db.db.dynamic

    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('mode', '=', 'historical')
      .where('timeframe', '=', timeframe)

    if (queueId !== null) {
      qb = qb.where('queueId', '=', queueId)
    } else {
      qb = qb.where('queueId', 'is', null)
    }
    if (moderatorDid) {
      qb = qb.where('moderatorDid', '=', moderatorDid)
    } else {
      qb = qb.where('moderatorDid', 'is', null)
    }
    if (reportTypes !== null) {
      qb = qb.where(sql`"reportTypes"::jsonb = ${jsonb(reportTypes)}::jsonb`)
    } else {
      qb = qb.where('reportTypes', 'is', null)
    }
    if (startDate) {
      qb = qb.where('computedAt', '>=', startDate)
    }
    if (endDate) {
      qb = qb.where('computedAt', '<=', endDate)
    }

    const keyset = new ComputedAtIdKeyset(ref('computedAt'), ref('id'))
    const paginatedBuilder = paginate(qb, {
      limit,
      cursor: opts.cursor,
      keyset,
      direction: 'desc',
      tryIndex: true,
    })

    const stats = await paginatedBuilder.execute()

    return { stats, cursor: keyset.packFromResult(stats) }
  }
}
