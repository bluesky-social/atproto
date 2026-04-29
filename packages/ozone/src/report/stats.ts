import { Selectable, sql } from 'kysely'
import { MINUTE } from '@atproto/common'
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

export type ReportStatGroup = {
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

// Batched query result types
type QueueCountRow = {
  queueId: number | null
  count: string
}
type QueueWindowRow = {
  queueId: number | null
  inboundCount: string
  actionedCount: string
  escalatedCount: string
  handlingTimeSum: string | null
  handlingTimeCount: string
}
type TypeCountRow = {
  reportType: string
  count: string
}
type TypeWindowRow = {
  reportType: string
  inboundCount: string
  actionedCount: string
  escalatedCount: string
  handlingTimeSum: string | null
  handlingTimeCount: string
}
type ModeratorWindowRow = {
  did: string
  inboundCount: string
  actionedCount: string
  handlingTimeSum: string | null
  handlingTimeCount: string
}
type BatchedStats = {
  queuePending: QueueCountRow[]
  queueWindow: QueueWindowRow[]
  typePending: TypeCountRow[]
  typeWindow: TypeWindowRow[]
  moderator: ModeratorWindowRow[]
}

export class ReportStatsService {
  constructor(public db: Database) {}

  static creator(): ReportStatsServiceCreator {
    return (db: Database) => new ReportStatsService(db)
  }

  /**
   * Compute stats for today and finalize yesterday if needed.
   * Called periodically by the StatsComputer daemon.
   */
  async materializeAll(opts?: { force?: boolean }): Promise<void> {
    try {
      const start = Date.now()
      const today = toDateString(new Date())
      const yesterday = toDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

      // Always compute today's stats
      await this.materializeDate(today, opts)

      // Finalize yesterday if its snapshot is missing or stale
      if (!opts?.force) {
        const yesterdayRow = await this.db.db
          .selectFrom('report_stat')
          .select('computedAt')
          .where('date', '=', yesterday)
          .orderBy('computedAt', 'desc')
          .executeTakeFirst()
        const endOfYesterday = new Date(`${yesterday}T23:59:59.999Z`).getTime()
        if (
          !yesterdayRow ||
          new Date(yesterdayRow.computedAt).getTime() < endOfYesterday
        ) {
          await this.materializeDate(yesterday, { force: true })
        }
      } else {
        await this.materializeDate(yesterday, { force: true })
      }

      const duration = Date.now() - start
      dbLogger.info({ duration }, 'report stats materialization completed')
    } catch (err) {
      dbLogger.error({ err }, 'report stats materialization errored')
    }
  }

  /**
   * Compute stats for a specific date range. Used by the refreshStats endpoint.
   */
  async refreshDateRange(opts: {
    startDate: string
    endDate: string
    queueIds?: number[]
  }): Promise<void> {
    const start = new Date(opts.startDate)
    const end = new Date(opts.endDate)

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = toDateString(d)
      if (opts.queueIds?.length) {
        // Recompute only specific queue groups for this date
        const batched = await this.computeBatchedStats(dateStr)
        for (const queueId of opts.queueIds) {
          const group: ReportStatGroup = {
            queueId,
            moderatorDid: null,
            reportTypes: null,
          }
          const stats = this.resolveGroupStats(group, batched)
          await this.upsertGroup(dateStr, group, stats)
        }
      } else {
        await this.materializeDate(dateStr, { force: true })
      }
    }
  }

  /** Compute and write all groups for a single date. */
  private async materializeDate(
    date: string,
    opts?: { force?: boolean },
  ): Promise<void> {
    const groups = await this.enumerateGroups()
    const batched = await this.computeBatchedStats(date)
    const today = toDateString(new Date())
    const isToday = date === today

    for (const group of groups) {
      try {
        if (!opts?.force) {
          const cached = await this.getStatForDate(date, group)
          if (cached) {
            // Historical dates: never recompute. Today: recompute if stale.
            if (!isToday) continue
            const age = Date.now() - new Date(cached.computedAt).getTime()
            if (age < REPORT_STAT_LIVE_TTL) continue
          }
        }
        const stats = this.resolveGroupStats(group, batched)
        await this.upsertGroup(date, group, stats)
      } catch (err) {
        dbLogger.error(
          { err, group, date },
          'error materializing report stats group',
        )
      }
    }
  }

  /** List out the groups to compute stats for. */
  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const groups: ReportStatGroup[] = []

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

    // aggregate
    groups.push({ queueId: null, moderatorDid: null, reportTypes: null })
    // per queue
    for (const queue of queues) {
      groups.push({ queueId: queue.id, moderatorDid: null, reportTypes: null })
    }
    // unqueued
    groups.push({ queueId: -1, moderatorDid: null, reportTypes: null })
    // per moderator
    for (const member of members) {
      groups.push({
        queueId: null,
        moderatorDid: member.did,
        reportTypes: null,
      })
    }
    // per report type group
    for (const groupTypes of Object.values(REPORT_TYPE_GROUPS)) {
      groups.push({
        queueId: null,
        moderatorDid: null,
        reportTypes: groupTypes,
      })
    }

    return groups
  }

  /**
   * Run batched GROUP BY queries for a calendar date.
   * Returns 5 result sets covering all group types.
   */
  private async computeBatchedStats(date: string): Promise<BatchedStats> {
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${nextDate(date)}T00:00:00.000Z`

    // Pending count is a snapshot of all non-closed reports at time of computation
    const queuePending = await this.db.db
      .selectFrom('report')
      .select(['queueId', sql<string>`count(*)`.as('count')])
      .where('status', '!=', 'closed')
      .where('queueId', 'is not', null)
      .groupBy('queueId')
      .execute()

    // Aggregate pending (includes all reports, even un-routed)
    const aggregatePending = await this.db.db
      .selectFrom('report')
      .select(sql<string>`count(*)`.as('count'))
      .where('status', '!=', 'closed')
      .executeTakeFirst()

    const queueWindow = await this.db.db
      .selectFrom('report')
      .select([
        'queueId',
        sql<string>`count(*)`.as('inboundCount'),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'actionedCount',
        ),
        sql<string>`count(*) filter (where "status" = 'escalated')`.as(
          'escalatedCount',
        ),
        sql<string>`sum(extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp))) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeSum',
        ),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeCount',
        ),
      ])
      .where('createdAt', '>=', dayStart)
      .where('createdAt', '<', dayEnd)
      .where('queueId', 'is not', null)
      .groupBy('queueId')
      .execute()

    // Aggregate windowed (includes all reports)
    const aggregateWindow = await this.db.db
      .selectFrom('report')
      .select([
        sql<string>`count(*)`.as('inboundCount'),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'actionedCount',
        ),
        sql<string>`count(*) filter (where "status" = 'escalated')`.as(
          'escalatedCount',
        ),
        sql<string>`sum(extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp))) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeSum',
        ),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeCount',
        ),
      ])
      .where('createdAt', '>=', dayStart)
      .where('createdAt', '<', dayEnd)
      .executeTakeFirst()

    const typePending = await this.db.db
      .selectFrom('report')
      .select(['reportType', sql<string>`count(*)`.as('count')])
      .where('status', '!=', 'closed')
      .groupBy('reportType')
      .execute()

    const typeWindow = await this.db.db
      .selectFrom('report')
      .select([
        'reportType',
        sql<string>`count(*)`.as('inboundCount'),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'actionedCount',
        ),
        sql<string>`count(*) filter (where "status" = 'escalated')`.as(
          'escalatedCount',
        ),
        sql<string>`sum(extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp))) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeSum',
        ),
        sql<string>`count(*) filter (where "status" = 'closed' and "closedAt" is not null and "closedAt" >= ${dayStart} and "closedAt" < ${dayEnd})`.as(
          'handlingTimeCount',
        ),
      ])
      .where('createdAt', '>=', dayStart)
      .where('createdAt', '<', dayEnd)
      .groupBy('reportType')
      .execute()

    const moderator = await this.db.db
      .selectFrom('report as r')
      .innerJoin('moderator_assignment as ma', (join) =>
        join.onRef('ma.reportId', '=', 'r.id').on('ma.endAt', 'is', null),
      )
      .select([
        'ma.did',
        sql<string>`count(*)`.as('inboundCount'),
        sql<string>`count(*) filter (where r."status" = 'closed')`.as(
          'actionedCount',
        ),
        sql<string>`sum(extract(epoch from (r."closedAt"::timestamp - ma."startAt"::timestamp))) filter (where r."status" = 'closed' and r."closedAt" is not null)`.as(
          'handlingTimeSum',
        ),
        sql<string>`count(*) filter (where r."status" = 'closed' and r."closedAt" is not null)`.as(
          'handlingTimeCount',
        ),
      ])
      .where('r.createdAt', '>=', dayStart)
      .where('r.createdAt', '<', dayEnd)
      .groupBy('ma.did')
      .execute()

    // Inject aggregate as a synthetic row with queueId=null so resolveQueueStats can find it
    const allQueuePending: QueueCountRow[] = [
      ...queuePending,
      { queueId: null, count: aggregatePending?.count ?? '0' },
    ]
    const allQueueWindow: QueueWindowRow[] = aggregateWindow
      ? [
          ...queueWindow,
          {
            queueId: null,
            inboundCount: aggregateWindow.inboundCount,
            actionedCount: aggregateWindow.actionedCount,
            escalatedCount: aggregateWindow.escalatedCount,
            handlingTimeSum: aggregateWindow.handlingTimeSum,
            handlingTimeCount: aggregateWindow.handlingTimeCount,
          },
        ]
      : queueWindow

    return {
      queuePending: allQueuePending,
      queueWindow: allQueueWindow,
      typePending,
      typeWindow,
      moderator,
    }
  }

  /** Resolve a single group's stats from batched query results (pure in-memory). */
  private resolveGroupStats(
    group: ReportStatGroup,
    batched: BatchedStats,
  ): ReportStatistics {
    if (group.moderatorDid) {
      return this.resolveModeratorStats(group.moderatorDid, batched.moderator)
    }
    if (group.reportTypes !== null) {
      return this.resolveReportTypeStats(group.reportTypes, batched)
    }
    return this.resolveQueueStats(group.queueId, batched)
  }

  private resolveQueueStats(
    queueId: number | null,
    batched: BatchedStats,
  ): AggregateStatistics | QueueStatistics {
    // queueId=null is the synthetic aggregate row
    const pending = batched.queuePending.find((r) => r.queueId === queueId)
    const window = batched.queueWindow.find((r) => r.queueId === queueId)

    const pendingCount = num(pending?.count)
    const inboundCount = num(window?.inboundCount)
    const actionedCount = num(window?.actionedCount)
    const escalatedCount = num(window?.escalatedCount)
    const handlingTimeSum = Number(window?.handlingTimeSum ?? 0)
    const handlingTimeCount = num(window?.handlingTimeCount)
    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec =
      handlingTimeCount > 0
        ? Math.round(handlingTimeSum / handlingTimeCount)
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

  private resolveReportTypeStats(
    reportTypes: string[],
    batched: BatchedStats,
  ): ReportTypeStatistics {
    const types = new Set(reportTypes)

    const matchingPending = batched.typePending.filter((r) =>
      types.has(r.reportType),
    )
    const matchingWindow = batched.typeWindow.filter((r) =>
      types.has(r.reportType),
    )

    const pendingCount = sumNum(matchingPending, 'count')
    const inboundCount = sumNum(matchingWindow, 'inboundCount')
    const actionedCount = sumNum(matchingWindow, 'actionedCount')
    const escalatedCount = sumNum(matchingWindow, 'escalatedCount')
    const handlingTimeSum = matchingWindow.reduce(
      (sum, r) => sum + Number(r.handlingTimeSum ?? 0),
      0,
    )
    const handlingTimeCount = sumNum(matchingWindow, 'handlingTimeCount')

    const actionRate =
      inboundCount > 0 ? Math.round((actionedCount / inboundCount) * 100) : 0
    const avgHandlingTimeSec =
      handlingTimeCount > 0
        ? Math.round(handlingTimeSum / handlingTimeCount)
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

  private resolveModeratorStats(
    moderatorDid: string,
    rows: ModeratorWindowRow[],
  ): ModeratorStatistics {
    const row = rows.find((r) => r.did === moderatorDid)

    const inboundCount = num(row?.inboundCount)
    const actionedCount = num(row?.actionedCount)
    const handlingTimeCount = num(row?.handlingTimeCount)
    const avgHandlingTimeSec =
      handlingTimeCount > 0 && row?.handlingTimeSum
        ? Math.round(Number(row.handlingTimeSum) / handlingTimeCount)
        : undefined

    return { inboundCount, actionedCount, avgHandlingTimeSec }
  }

  /** Write or overwrite a stat row for a specific date + group. */
  private async upsertGroup(
    date: string,
    group: ReportStatGroup,
    stats: ReportStatistics,
  ): Promise<Selectable<ReportStat>> {
    const { queueId, moderatorDid, reportTypes } = group
    const computedAt = new Date().toISOString()

    const pendingCount =
      'pendingCount' in stats ? stats.pendingCount ?? null : null
    const escalatedCount =
      'escalatedCount' in stats ? stats.escalatedCount ?? null : null
    const actionRate = 'actionRate' in stats ? stats.actionRate ?? null : null

    const values = {
      date,
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
    }

    return this.db.transaction(async (dbTxn) => {
      // Delete existing row for this date + group
      let del = dbTxn.db.deleteFrom('report_stat').where('date', '=', date)
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

      return dbTxn.db
        .insertInto('report_stat')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
    })
  }

  // ─── Read methods ───

  /** Get a single stat row for a date + group. */
  private async getStatForDate(
    date: string,
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', date)
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

  /** Get today's live stats for a group. */
  async getLiveStats(
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    const today = toDateString(new Date())
    return this.getStatForDate(today, group)
  }

  /** Get live stats for multiple queues in a single query. */
  async getLiveStatsForQueues(
    queueIds: number[],
  ): Promise<Map<number, Selectable<ReportStat>>> {
    if (!queueIds.length) return new Map()

    const today = toDateString(new Date())
    const rows = await this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', today)
      .where('queueId', 'in', queueIds)
      .where('moderatorDid', 'is', null)
      .where('reportTypes', 'is', null)
      .execute()

    const result = new Map<number, Selectable<ReportStat>>()
    for (const row of rows) {
      if (row.queueId !== null) {
        result.set(row.queueId, row)
      }
    }
    return result
  }

  /** Get historical stats for a date range, paginated. */
  async getHistoricalStats(opts: {
    group: ReportStatGroup
    startDate?: string
    endDate?: string
    limit: number
    cursor?: string
  }): Promise<{ stats: Selectable<ReportStat>[]; cursor?: string }> {
    const { group, startDate, endDate, limit } = opts
    const { queueId, moderatorDid, reportTypes } = group
    const { ref } = this.db.db.dynamic

    let qb = this.db.db.selectFrom('report_stat').selectAll()

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
      qb = qb.where('date', '>=', toDateString(new Date(startDate)))
    }
    if (endDate) {
      qb = qb.where('date', '<=', toDateString(new Date(endDate)))
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

// ─── Helpers ───

/** Parse a pg bigint string to number, defaulting to 0. */
function num(val: string | undefined | null): number {
  return val ? Number(val) : 0
}

/** Sum a numeric string field across rows. */
function sumNum<T>(rows: T[], field: keyof T): number {
  return rows.reduce((sum, r) => sum + Number(r[field] ?? 0), 0)
}

/** Convert a Date to an ISO date string (YYYY-MM-DD). */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Get the next calendar date string. */
function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return toDateString(d)
}
