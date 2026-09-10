import { type Selectable, sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import type { DatetimeString, DidString } from '@atproto/lex'
import { currentDatetimeString, toDatetimeString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import { ComputedAtIdKeyset, paginate } from '../db/pagination.js'
import type { DateString, ReportStat } from '../db/schema/report_stat.js'
import { jsonb } from '../db/types.js'
import { com, tools } from '../lexicons/index.js'
import { dbLogger } from '../logger.js'

// @NOTE Note some values here are not part of the lexicon and hard coded for
// legacy reasons.

/**
 * Grouped report types. Stats are computed per group rather than per individual report type.
 * Frontend should match for proper stat lookup.
 * https://github.com/bluesky-social/ozone/blob/main/components/reports/helpers/getType.ts
 */
export const REPORT_TYPE_GROUPS: Record<string, string[]> = {
  Legacy: [
    com.atproto.moderation.defs.ReasonSpam,
    com.atproto.moderation.defs.ReasonViolation,
    com.atproto.moderation.defs.ReasonMisleading,
    com.atproto.moderation.defs.ReasonSexual,
    com.atproto.moderation.defs.ReasonRude,
    com.atproto.moderation.defs.ReasonOther,
    com.atproto.moderation.defs.ReasonAppeal,
  ],
  Appeal: [tools.ozone.report.defs.ReasonAppeal],
  Violence: [
    'tools.ozone.report.defs#reasonViolenceAnimalWelfare',
    tools.ozone.report.defs.ReasonViolenceThreats,
    tools.ozone.report.defs.ReasonViolenceGraphicContent,
    'tools.ozone.report.defs#reasonViolenceSelfHarm',
    tools.ozone.report.defs.ReasonViolenceGlorification,
    tools.ozone.report.defs.ReasonViolenceExtremistContent,
    tools.ozone.report.defs.ReasonViolenceTrafficking,
    tools.ozone.report.defs.ReasonViolenceOther,
  ],
  Sexual: [
    tools.ozone.report.defs.ReasonSexualAbuseContent,
    'tools.ozone.report.defs#reasonSexualNCII',
    'tools.ozone.report.defs#reasonSexualSextortion',
    tools.ozone.report.defs.ReasonSexualDeepfake,
    tools.ozone.report.defs.ReasonSexualAnimal,
    tools.ozone.report.defs.ReasonSexualUnlabeled,
    tools.ozone.report.defs.ReasonSexualOther,
  ],
  'Child Safety': [
    'tools.ozone.report.defs#reasonChildSafetyCSAM',
    tools.ozone.report.defs.ReasonChildSafetyGroom,
    'tools.ozone.report.defs#reasonChildSafetyMinorPrivacy',
    'tools.ozone.report.defs#reasonChildSafetyEndangerment',
    tools.ozone.report.defs.ReasonChildSafetyHarassment,
    'tools.ozone.report.defs#reasonChildSafetyPromotion',
    tools.ozone.report.defs.ReasonChildSafetyOther,
  ],
  Harassment: [
    tools.ozone.report.defs.ReasonHarassmentTroll,
    tools.ozone.report.defs.ReasonHarassmentTargeted,
    tools.ozone.report.defs.ReasonHarassmentHateSpeech,
    tools.ozone.report.defs.ReasonHarassmentDoxxing,
    tools.ozone.report.defs.ReasonHarassmentOther,
  ],
  Misleading: [
    tools.ozone.report.defs.ReasonMisleadingBot,
    tools.ozone.report.defs.ReasonMisleadingImpersonation,
    tools.ozone.report.defs.ReasonMisleadingSpam,
    tools.ozone.report.defs.ReasonMisleadingScam,
    'tools.ozone.report.defs#reasonMisleadingSyntheticContent',
    'tools.ozone.report.defs#reasonMisleadingMisinformation',
    tools.ozone.report.defs.ReasonMisleadingOther,
  ],
  'Rule Violations': [
    tools.ozone.report.defs.ReasonRuleSiteSecurity,
    'tools.ozone.report.defs#reasonRuleStolenContent',
    tools.ozone.report.defs.ReasonRuleProhibitedSales,
    tools.ozone.report.defs.ReasonRuleBanEvasion,
    tools.ozone.report.defs.ReasonRuleOther,
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
  moderatorDid: DidString | null
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
  did: DidString
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

type UpsertRow = {
  date: DateString
  queueId: number | null
  moderatorDid: DidString | null
  reportTypes: string[] | null
  inboundCount: number | null
  pendingCount: number | null
  actionedCount: number | null
  escalatedCount: number | null
  actionRate: number | null
  avgHandlingTimeSec: number | null
  computedAt: DatetimeString
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
        const rows: UpsertRow[] = []
        for (const queueId of opts.queueIds) {
          const group: ReportStatGroup = {
            queueId,
            moderatorDid: null,
            reportTypes: null,
          }
          const stats = this.resolveGroupStats(group, batched)
          rows.push(this.buildUpsertRow(dateStr, group, stats))
        }
        await this.bulkUpsert(rows)
      } else {
        await this.materializeDate(dateStr, { force: true })
      }
    }
  }

  /** Compute and write all groups for a single date. */
  private async materializeDate(
    date: DateString,
    opts?: { force?: boolean },
  ): Promise<void> {
    const groups = await this.enumerateGroups()
    const batched = await this.computeBatchedStats(date)
    const today = toDateString(new Date())
    const isToday = date === today

    // Batch the cache check so we don't issue one SELECT per group.
    const existingByKey = !opts?.force
      ? await this.fetchExistingStatsByKey(date)
      : null

    const rows: UpsertRow[] = []
    for (const group of groups) {
      try {
        if (existingByKey) {
          const cached = existingByKey.get(groupKey(group))
          if (cached) {
            // Historical dates: never recompute. Today: recompute if stale.
            if (!isToday) continue
            const age = Date.now() - new Date(cached.computedAt).getTime()
            if (age < REPORT_STAT_LIVE_TTL) continue
          }
        }
        const stats = this.resolveGroupStats(group, batched)
        rows.push(this.buildUpsertRow(date, group, stats))
      } catch (err) {
        dbLogger.error(
          { err, group, date },
          'error preparing report stats group',
        )
      }
    }

    await this.bulkUpsert(rows)
  }

  /** Fetch all stat rows for a date, keyed by groupKey for O(1) lookup. */
  private async fetchExistingStatsByKey(
    date: DateString,
  ): Promise<Map<string, Selectable<ReportStat>>> {
    const existing = await this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', date)
      .execute()
    const map = new Map<string, Selectable<ReportStat>>()
    for (const row of existing) {
      map.set(
        groupKey({
          queueId: row.queueId,
          moderatorDid: row.moderatorDid,
          reportTypes: row.reportTypes,
        }),
        row,
      )
    }
    return map
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
        tools.ozone.team.defs.RoleAdmin,
        tools.ozone.team.defs.RoleModerator,
        tools.ozone.team.defs.RoleTriage,
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
  private async computeBatchedStats(date: DateString): Promise<BatchedStats> {
    const dayStart: DatetimeString = `${date}T00:00:00.000Z`
    const dayEnd: DatetimeString = `${nextDate(date)}T00:00:00.000Z`

    const [queuePending, aggregatePending] = await Promise.all([
      // Pending count is a snapshot of all non-closed reports at time of computation
      this.db.db
        .selectFrom('report')
        .select(['queueId', sql<string>`count(*)`.as('count')])
        .where('status', '!=', 'closed')
        .where('queueId', 'is not', null)
        .groupBy('queueId')
        .execute(),
      // Aggregate pending (includes all reports, even un-routed)
      this.db.db
        .selectFrom('report')
        .select(sql<string>`count(*)`.as('count'))
        .where('status', '!=', 'closed')
        .executeTakeFirst(),
    ])

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
    moderatorDid: DidString,
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

  /** Build an upsert row from (date, group, stats). */
  private buildUpsertRow(
    date: DateString,
    group: ReportStatGroup,
    stats: ReportStatistics,
  ): UpsertRow {
    const pendingCount =
      'pendingCount' in stats ? (stats.pendingCount ?? null) : null
    const escalatedCount =
      'escalatedCount' in stats ? (stats.escalatedCount ?? null) : null
    const actionRate = 'actionRate' in stats ? (stats.actionRate ?? null) : null

    return {
      date,
      queueId: group.queueId,
      moderatorDid: group.moderatorDid,
      reportTypes: group.reportTypes,
      inboundCount: stats.inboundCount ?? null,
      pendingCount,
      actionedCount: stats.actionedCount ?? null,
      escalatedCount,
      actionRate,
      avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
      computedAt: currentDatetimeString(),
    }
  }

  /**
   * Wraps a DELETE+INSERT for each row in a single transaction so we pay one
   * commit per cycle instead of one per group. NULL-aware WHERE clauses match
   * the existing PG <15 NULL semantics without needing a unique index.
   */
  private async bulkUpsert(rows: UpsertRow[]): Promise<void> {
    if (!rows.length) return

    await this.db.transaction(async (dbTxn) => {
      for (const r of rows) {
        let del = dbTxn.db.deleteFrom('report_stat').where('date', '=', r.date)
        del =
          r.queueId !== null
            ? del.where('queueId', '=', r.queueId)
            : del.where('queueId', 'is', null)
        del =
          r.moderatorDid !== null
            ? del.where('moderatorDid', '=', r.moderatorDid)
            : del.where('moderatorDid', 'is', null)
        del =
          r.reportTypes !== null
            ? del.where(
                sql<boolean>`"reportTypes"::jsonb = ${jsonb(r.reportTypes)}::jsonb`,
              )
            : del.where('reportTypes', 'is', null)
        await del.execute()

        await dbTxn.db
          .insertInto('report_stat')
          .values({
            date: r.date,
            queueId: r.queueId,
            moderatorDid: r.moderatorDid,
            reportTypes: r.reportTypes !== null ? jsonb(r.reportTypes) : null,
            inboundCount: r.inboundCount,
            pendingCount: r.pendingCount,
            actionedCount: r.actionedCount,
            escalatedCount: r.escalatedCount,
            actionRate: r.actionRate,
            avgHandlingTimeSec: r.avgHandlingTimeSec,
            computedAt: r.computedAt,
          })
          .execute()
      }
    })
  }

  // ─── Read methods ───

  /** Get a single stat row for a date + group. */
  private async getStatForDate(
    date: DateString,
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
        sql<boolean>`"reportTypes"::jsonb = ${jsonb(group.reportTypes)}::jsonb`,
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
      qb = qb.where(
        sql<boolean>`"reportTypes"::jsonb = ${jsonb(reportTypes)}::jsonb`,
      )
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

/**
 * Stable cache-key for a stat group. Used to look up an existing row in the
 * batched cache map without issuing per-group SELECTs. Report types are
 * stringified in stored order, which matches REPORT_TYPE_GROUPS.
 */
function groupKey(g: ReportStatGroup): string {
  return [
    g.queueId ?? 'null',
    g.moderatorDid ?? 'null',
    g.reportTypes ? JSON.stringify(g.reportTypes) : 'null',
  ].join('|')
}

/** Convert a Date to an ISO date string (YYYY-MM-DD). */
function toDateString(d: Date): DateString {
  return toDatetimeString(d).slice(0, 10) as DateString
}

/** Get the next calendar date string. */
function nextDate(dateStr: DateString): DateString {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return toDateString(d)
}
