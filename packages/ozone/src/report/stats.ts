import { type Selectable, sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import type { Database } from '../db/index.js'
import { ComputedAtIdKeyset, paginate } from '../db/pagination.js'
import type { ReportStat } from '../db/schema/report_stat.js'
import { jsonb } from '../db/types.js'
import { dbLogger } from '../logger.js'

/**
 * Grouped report types. Stats are computed per group rather than per individual report type.
 * Frontend should match for proper stat lookup.
 * https://github.com/bluesky-social/ozone/blob/main/components/reports/helpers/getType.ts
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

type Numeric = string | number | null

export type ReportStatistics = {
  inboundCount: number
  pendingCount?: number
  closedCount: number
  actionedCount: number
  acknowledgedCount: number
  escalatedCount: number
  labelActionCount: number
  tagActionCount: number
  takedownActionCount: number
  ahtDurationSec: number
  ahtSampleCount: number
  resolutionDurationSec: number
  resolutionSampleCount: number
  actionRate?: number
  avgHandlingTimeSec?: number
  avgResolutionTimeSec?: number
}

type CountByQueueRow = {
  queueId: number | null
  count: Numeric
}

type CountByTypeRow = {
  reportType: string
  count: Numeric
}

type LifecycleRow = {
  groupKind: 'aggregate' | 'queue' | 'reportType' | 'moderator'
  queueId: number | null
  reportType: string | null
  moderatorDid: string | null
  closedCount: Numeric
  actionedCount: Numeric
  acknowledgedCount: Numeric
  escalatedCount: Numeric
  labelActionCount: Numeric
  tagActionCount: Numeric
  takedownActionCount: Numeric
  ahtDurationSec: Numeric
  ahtSampleCount: Numeric
  resolutionDurationSec: Numeric
  resolutionSampleCount: Numeric
}

type LifecycleMetric = Exclude<
  keyof LifecycleRow,
  'groupKind' | 'queueId' | 'reportType' | 'moderatorDid'
>

// Batched query result types
type BatchedStats = {
  queueInbound: CountByQueueRow[]
  queuePending: CountByQueueRow[]
  typeInbound: CountByTypeRow[]
  typePending: CountByTypeRow[]
  lifecycle: LifecycleRow[]
}

type UpsertRow = {
  date: string
  queueId: number | null
  moderatorDid: string | null
  reportTypes: string[] | null
  inboundCount: number | null
  pendingCount: number | null
  closedCount: number | null
  actionedCount: number | null
  acknowledgedCount: number | null
  escalatedCount: number | null
  labelActionCount: number | null
  tagActionCount: number | null
  takedownActionCount: number | null
  ahtDurationSec: number | null
  ahtSampleCount: number | null
  resolutionDurationSec: number | null
  resolutionSampleCount: number | null
  actionRate: number | null
  avgHandlingTimeSec: number | null
  avgResolutionTimeSec: number | null
  computedAt: string
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
  async materializeAll(opts?: { force?: boolean }): Promise<{
    rowsWritten: number
  }> {
    try {
      const start = Date.now()
      const today = toDateString(new Date())
      const yesterday = toDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
      // Always compute today's stats
      let rowsWritten = await this.materializeDate(today, opts)

      // Finalize yesterday if its snapshot is missing or stale
      const yesterdayRow = await this.db.db
        .selectFrom('report_stat')
        .select('computedAt')
        .where('date', '=', yesterday)
        .orderBy('computedAt', 'desc')
        .executeTakeFirst()
      const endOfYesterday = new Date(`${yesterday}T23:59:59.999Z`).getTime()
      if (
        opts?.force ||
        !yesterdayRow ||
        new Date(yesterdayRow.computedAt).getTime() < endOfYesterday
      ) {
        rowsWritten += await this.materializeDate(yesterday, { force: true })
      }

      dbLogger.info(
        {
          event: 'report_stats_materialization',
          durationMs: Date.now() - start,
          rowsWritten,
        },
        'report stats materialization completed',
      )
      return { rowsWritten }
    } catch (err) {
      dbLogger.error({ err }, 'report stats materialization errored')
      throw err
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
    const startedAt = Date.now()
    const start = new Date(opts.startDate)
    const end = new Date(opts.endDate)
    const today = toDateString(new Date())
    let rowsWritten = 0

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = toDateString(d)
      if (!opts.queueIds?.length) {
        rowsWritten += await this.materializeDate(date, { force: true })
        continue
      }

      const batched = await this.computeBatchedStats(date)
      const existing = await this.fetchExistingStatsByKey(date)
      const rows: UpsertRow[] = []
      for (const queueId of opts.queueIds) {
        const group: ReportStatGroup = {
          queueId,
          moderatorDid: null,
          reportTypes: null,
        }
        const pendingOverride =
          date === today
            ? undefined
            : (existing.get(groupKey(group))?.pendingCount ?? null)
        rows.push(
          this.buildUpsertRow(
            date,
            group,
            this.resolveGroupStats(group, batched),
            pendingOverride,
          ),
        )
      }
      await this.bulkUpsert(rows)
      rowsWritten += rows.length
    }

    dbLogger.info(
      {
        event: 'report_stats_refresh',
        durationMs: Date.now() - startedAt,
        rowsWritten,
        startDate: opts.startDate,
        endDate: opts.endDate,
      },
      'report stats refresh completed',
    )
  }

  /** Compute and write all groups for a single date. */
  private async materializeDate(
    date: string,
    opts?: { force?: boolean },
  ): Promise<number> {
    const groups = await this.enumerateGroups()
    const batched = await this.computeBatchedStats(date)
    const today = toDateString(new Date())
    const isToday = date === today

    // Batch the cache check so we don't issue one SELECT per group.
    const existing = await this.fetchExistingStatsByKey(date)
    const rows: UpsertRow[] = []

    for (const group of groups) {
      try {
        const cached = existing.get(groupKey(group))
        if (!opts?.force && cached) {
          // Historical dates: never recompute. Today: recompute if stale.
          if (!isToday) continue
          const age = Date.now() - new Date(cached.computedAt).getTime()
          if (age < REPORT_STAT_LIVE_TTL) continue
        }

        const pendingOverride = isToday
          ? undefined
          : (cached?.pendingCount ?? null)
        rows.push(
          this.buildUpsertRow(
            date,
            group,
            this.resolveGroupStats(group, batched),
            pendingOverride,
          ),
        )
      } catch (err) {
        dbLogger.error(
          { err, group, date },
          'error preparing report stats group',
        )
      }
    }

    await this.bulkUpsert(rows)
    return rows.length
  }

  /** Fetch all stat rows for a date, keyed by groupKey for O(1) lookup. */
  private async fetchExistingStatsByKey(
    date: string,
  ): Promise<Map<string, Selectable<ReportStat>>> {
    const rows = await this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', date)
      .execute()
    return new Map(
      rows.map((row) => [
        groupKey({
          queueId: row.queueId,
          moderatorDid: row.moderatorDid,
          reportTypes: row.reportTypes,
        }),
        row,
      ]),
    )
  }

  /** List out the groups to compute stats for. */
  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const [queues, members] = await Promise.all([
      this.db.db
        .selectFrom('report_queue')
        .select('id')
        .where('enabled', '=', true)
        .where('deletedAt', 'is', null)
        .execute(),
      this.db.db
        .selectFrom('member')
        .select('did')
        .where('disabled', '=', false)
        .where('role', 'in', [
          'tools.ozone.team.defs#roleAdmin',
          'tools.ozone.team.defs#roleModerator',
          'tools.ozone.team.defs#roleTriage',
        ])
        .execute(),
    ])

    return [
      // aggregate
      { queueId: null, moderatorDid: null, reportTypes: null },
      // per queue
      ...queues.map((queue) => ({
        queueId: queue.id,
        moderatorDid: null,
        reportTypes: null,
      })),
      // unqueued
      { queueId: -1, moderatorDid: null, reportTypes: null },
      // per moderator
      ...members.map((member) => ({
        queueId: null,
        moderatorDid: member.did,
        reportTypes: null,
      })),
      // per report type group
      ...Object.values(REPORT_TYPE_GROUPS).map((reportTypes) => ({
        queueId: null,
        moderatorDid: null,
        reportTypes,
      })),
    ]
  }

  /**
   * Run batched GROUP BY queries for a calendar date.
   * Returns 5 result sets covering all group types.
   */
  private async computeBatchedStats(date: string): Promise<BatchedStats> {
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${nextDate(date)}T00:00:00.000Z`

    const [
      queueInboundRows,
      aggregateInbound,
      queuePendingRows,
      aggregatePending,
    ] = await Promise.all([
      this.db.db
        .selectFrom('report')
        .select([
          sql<number>`coalesce("queueId", -1)`.as('queueId'),
          sql<string>`count(*)`.as('count'),
        ])
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .groupBy(sql`coalesce("queueId", -1)`)
        .execute(),
      this.db.db
        .selectFrom('report')
        .select(sql<string>`count(*)`.as('count'))
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .executeTakeFirst(),
      this.db.db
        .selectFrom('report')
        .select([
          sql<number>`coalesce("queueId", -1)`.as('queueId'),
          sql<string>`count(*)`.as('count'),
        ])
        .where('status', '!=', 'closed')
        .groupBy(sql`coalesce("queueId", -1)`)
        .execute(),
      this.db.db
        .selectFrom('report')
        .select(sql<string>`count(*)`.as('count'))
        .where('status', '!=', 'closed')
        .executeTakeFirst(),
    ])

    const [typeInbound, typePending] = await Promise.all([
      this.db.db
        .selectFrom('report')
        .select(['reportType', sql<string>`count(*)`.as('count')])
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .groupBy('reportType')
        .execute(),
      this.db.db
        .selectFrom('report')
        .select(['reportType', sql<string>`count(*)`.as('count')])
        .where('status', '!=', 'closed')
        .groupBy('reportType')
        .execute(),
    ])

    const lifecycleResult = await sql<LifecycleRow>`
      with close_base as (
        select
          'close' as "metricType",
          r."closedAt" as "eventAt",
          coalesce(r."queueId", -1) as "statQueueId",
          r."assignedTo" as "moderatorDid",
          r."reportType",
          r."createdAt" as "reportCreatedAt",
          r."assignedAt" as "reportAssignedAt",
          me.action as "actionType"
        from report r
        left join moderation_event me on me.id = case
          when jsonb_array_length(coalesce(r."actionEventIds", '[]'::jsonb)) > 0
          then (r."actionEventIds" ->> (jsonb_array_length(r."actionEventIds") - 1))::integer
        end
        where r."closedAt" >= ${dayStart}
          and r."closedAt" < ${dayEnd}
      ),
      escalation_base as (
        select
          'escalation' as "metricType",
          ra."createdAt" as "eventAt",
          coalesce(r."queueId", -1) as "statQueueId",
          r."assignedTo" as "moderatorDid",
          r."reportType",
          r."createdAt" as "reportCreatedAt",
          null::text as "reportAssignedAt",
          null::text as "actionType"
        from report_activity ra
        join report r on r.id = ra."reportId"
        where ra."activityType" = 'escalationActivity'
          and ra."createdAt" >= ${dayStart}
          and ra."createdAt" < ${dayEnd}
      ),
      lifecycle_base as (
        select * from close_base
        union all
        select * from escalation_base
      )
      select
        case
          when grouping("statQueueId") = 0 then 'queue'
          when grouping("reportType") = 0 then 'reportType'
          when grouping("moderatorDid") = 0 then 'moderator'
          else 'aggregate'
        end as "groupKind",
        case when grouping("statQueueId") = 0 then "statQueueId" end as "queueId",
        case when grouping("reportType") = 0 then "reportType" end as "reportType",
        case when grouping("moderatorDid") = 0 then "moderatorDid" end as "moderatorDid",
        count(*) filter (where "metricType" = 'close') as "closedCount",
        count(*) filter (where "metricType" = 'close' and "actionType" in (
          'tools.ozone.moderation.defs#modEventLabel',
          'tools.ozone.moderation.defs#modEventTag',
          'tools.ozone.moderation.defs#modEventTakedown'
        )) as "actionedCount",
        count(*) filter (where "metricType" = 'close' and coalesce("actionType", '') not in (
          'tools.ozone.moderation.defs#modEventLabel',
          'tools.ozone.moderation.defs#modEventTag',
          'tools.ozone.moderation.defs#modEventTakedown'
        )) as "acknowledgedCount",
        count(*) filter (where "metricType" = 'escalation') as "escalatedCount",
        count(*) filter (where "metricType" = 'close' and "actionType" = 'tools.ozone.moderation.defs#modEventLabel') as "labelActionCount",
        count(*) filter (where "metricType" = 'close' and "actionType" = 'tools.ozone.moderation.defs#modEventTag') as "tagActionCount",
        count(*) filter (where "metricType" = 'close' and "actionType" = 'tools.ozone.moderation.defs#modEventTakedown') as "takedownActionCount",
        coalesce(sum(greatest(0, extract(epoch from ("eventAt"::timestamp - "reportAssignedAt"::timestamp))))
          filter (where "metricType" = 'close' and "reportAssignedAt" is not null), 0)
          as "ahtDurationSec",
        count(*) filter (where "metricType" = 'close' and "reportAssignedAt" is not null)
          as "ahtSampleCount",
        coalesce(sum(greatest(0, extract(epoch from ("eventAt"::timestamp - "reportCreatedAt"::timestamp))))
          filter (where "metricType" = 'close'), 0) as "resolutionDurationSec",
        count(*) filter (where "metricType" = 'close') as "resolutionSampleCount"
      from lifecycle_base
      group by grouping sets ((), ("statQueueId"), ("reportType"), ("moderatorDid"))
    `.execute(this.db.db)

    return {
      queueInbound: [
        ...queueInboundRows,
        { queueId: null, count: aggregateInbound?.count ?? 0 },
      ],
      queuePending: [
        ...queuePendingRows,
        { queueId: null, count: aggregatePending?.count ?? 0 },
      ],
      typeInbound,
      typePending,
      lifecycle: lifecycleResult.rows,
    }
  }

  private resolveGroupStats(
    group: ReportStatGroup,
    batched: BatchedStats,
  ): ReportStatistics {
    if (group.moderatorDid) {
      return this.resolveStats(
        0,
        undefined,
        batched.lifecycle.find(
          (row) =>
            row.groupKind === 'moderator' &&
            row.moderatorDid === group.moderatorDid,
        ),
      )
    }

    if (group.reportTypes !== null) {
      const reportTypes = new Set(group.reportTypes)
      return this.resolveStats(
        batched.typeInbound.reduce(
          (total, row) =>
            total + (reportTypes.has(row.reportType) ? num(row.count) : 0),
          0,
        ),
        batched.typePending.reduce(
          (total, row) =>
            total + (reportTypes.has(row.reportType) ? num(row.count) : 0),
          0,
        ),
        batched.lifecycle.filter(
          (row) =>
            row.groupKind === 'reportType' &&
            row.reportType !== null &&
            reportTypes.has(row.reportType),
        ),
      )
    }

    return this.resolveStats(
      num(
        batched.queueInbound.find((row) => row.queueId === group.queueId)
          ?.count,
      ),
      num(
        batched.queuePending.find((row) => row.queueId === group.queueId)
          ?.count,
      ),
      batched.lifecycle.find(
        (row) =>
          row.groupKind === (group.queueId === null ? 'aggregate' : 'queue') &&
          (group.queueId === null || row.queueId === group.queueId),
      ),
    )
  }

  private resolveStats(
    inboundCount: number,
    pendingCount: number | undefined,
    lifecycle: LifecycleRow | LifecycleRow[] | undefined,
  ): ReportStatistics {
    const lifecycleRows = lifecycle
      ? Array.isArray(lifecycle)
        ? lifecycle
        : [lifecycle]
      : []
    const sum = (key: LifecycleMetric) =>
      lifecycleRows.reduce((total, row) => total + num(row[key]), 0)
    const closedCount = sum('closedCount')
    const actionedCount = sum('actionedCount')
    const ahtDurationSec = Math.round(sum('ahtDurationSec'))
    const ahtSampleCount = sum('ahtSampleCount')
    const resolutionDurationSec = Math.round(sum('resolutionDurationSec'))
    const resolutionSampleCount = sum('resolutionSampleCount')
    return {
      inboundCount,
      pendingCount,
      closedCount,
      actionedCount,
      acknowledgedCount: sum('acknowledgedCount'),
      escalatedCount: sum('escalatedCount'),
      labelActionCount: sum('labelActionCount'),
      tagActionCount: sum('tagActionCount'),
      takedownActionCount: sum('takedownActionCount'),
      ahtDurationSec,
      ahtSampleCount,
      resolutionDurationSec,
      resolutionSampleCount,
      actionRate:
        closedCount > 0
          ? Math.round((actionedCount / closedCount) * 100)
          : undefined,
      avgHandlingTimeSec:
        ahtSampleCount > 0
          ? Math.round(ahtDurationSec / ahtSampleCount)
          : undefined,
      avgResolutionTimeSec:
        resolutionSampleCount > 0
          ? Math.round(resolutionDurationSec / resolutionSampleCount)
          : undefined,
    }
  }

  private buildUpsertRow(
    date: string,
    group: ReportStatGroup,
    stats: ReportStatistics,
    pendingOverride?: number | null,
  ): UpsertRow {
    return {
      date,
      queueId: group.queueId,
      moderatorDid: group.moderatorDid,
      reportTypes: group.reportTypes,
      inboundCount: stats.inboundCount,
      pendingCount:
        pendingOverride !== undefined
          ? pendingOverride
          : (stats.pendingCount ?? null),
      closedCount: stats.closedCount,
      actionedCount: stats.actionedCount,
      acknowledgedCount: stats.acknowledgedCount,
      escalatedCount: stats.escalatedCount,
      labelActionCount: stats.labelActionCount,
      tagActionCount: stats.tagActionCount,
      takedownActionCount: stats.takedownActionCount,
      ahtDurationSec: stats.ahtDurationSec,
      ahtSampleCount: stats.ahtSampleCount,
      resolutionDurationSec: stats.resolutionDurationSec,
      resolutionSampleCount: stats.resolutionSampleCount,
      actionRate: stats.actionRate ?? null,
      avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
      avgResolutionTimeSec: stats.avgResolutionTimeSec ?? null,
      computedAt: new Date().toISOString(),
    }
  }

  private async bulkUpsert(rows: UpsertRow[]): Promise<void> {
    if (!rows.length) return

    await this.db.transaction(async (dbTxn) => {
      for (const row of rows) {
        let del = dbTxn.db
          .deleteFrom('report_stat')
          .where('date', '=', row.date)
        del =
          row.queueId !== null
            ? del.where('queueId', '=', row.queueId)
            : del.where('queueId', 'is', null)
        del =
          row.moderatorDid !== null
            ? del.where('moderatorDid', '=', row.moderatorDid)
            : del.where('moderatorDid', 'is', null)
        del =
          row.reportTypes !== null
            ? del.where(
                sql<boolean>`"reportTypes"::jsonb = ${jsonb(row.reportTypes)}::jsonb`,
              )
            : del.where('reportTypes', 'is', null)
        await del.execute()

        await dbTxn.db
          .insertInto('report_stat')
          .values({
            ...row,
            reportTypes:
              row.reportTypes !== null ? jsonb(row.reportTypes) : null,
          })
          .execute()
      }
    })
  }

  private async getStatForDate(
    date: string,
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    let qb = this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', date)
    qb =
      group.queueId !== null
        ? qb.where('queueId', '=', group.queueId)
        : qb.where('queueId', 'is', null)
    qb = group.moderatorDid
      ? qb.where('moderatorDid', '=', group.moderatorDid)
      : qb.where('moderatorDid', 'is', null)
    qb =
      group.reportTypes !== null
        ? qb.where(
            sql<boolean>`"reportTypes"::jsonb = ${jsonb(group.reportTypes)}::jsonb`,
          )
        : qb.where('reportTypes', 'is', null)
    return qb.executeTakeFirst()
  }

  async getLiveStats(
    group: ReportStatGroup,
  ): Promise<Selectable<ReportStat> | undefined> {
    return this.getStatForDate(toDateString(new Date()), group)
  }

  async getLiveStatsForQueues(
    queueIds: number[],
  ): Promise<Map<number, Selectable<ReportStat>>> {
    if (!queueIds.length) return new Map()
    const rows = await this.db.db
      .selectFrom('report_stat')
      .selectAll()
      .where('date', '=', toDateString(new Date()))
      .where('queueId', 'in', queueIds)
      .where('moderatorDid', 'is', null)
      .where('reportTypes', 'is', null)
      .execute()
    return new Map(
      rows
        .filter((row) => row.queueId !== null)
        .map((row) => [row.queueId!, row]),
    )
  }

  async getHistoricalStats(opts: {
    group: ReportStatGroup
    startDate?: string
    endDate?: string
    limit: number
    cursor?: string
  }): Promise<{ stats: Selectable<ReportStat>[]; cursor?: string }> {
    const { group } = opts
    const { ref } = this.db.db.dynamic
    let qb = this.db.db.selectFrom('report_stat').selectAll()

    qb =
      group.queueId !== null
        ? qb.where('queueId', '=', group.queueId)
        : qb.where('queueId', 'is', null)
    qb = group.moderatorDid
      ? qb.where('moderatorDid', '=', group.moderatorDid)
      : qb.where('moderatorDid', 'is', null)
    qb =
      group.reportTypes !== null
        ? qb.where(
            sql<boolean>`"reportTypes"::jsonb = ${jsonb(group.reportTypes)}::jsonb`,
          )
        : qb.where('reportTypes', 'is', null)
    if (opts.startDate) {
      qb = qb.where('date', '>=', toDateString(new Date(opts.startDate)))
    }
    if (opts.endDate) {
      qb = qb.where('date', '<=', toDateString(new Date(opts.endDate)))
    }

    const keyset = new ComputedAtIdKeyset(ref('computedAt'), ref('id'))
    const stats = await paginate(qb, {
      limit: opts.limit,
      cursor: opts.cursor,
      keyset,
      direction: 'desc',
      tryIndex: true,
    }).execute()
    return { stats, cursor: keyset.packFromResult(stats) }
  }
}

function num(value: Numeric | undefined): number {
  return value == null ? 0 : Number(value)
}

/**
 * Stable key for a stat group. reportTypes arrays are JSON-stringified in
 * stored order, which matches REPORT_TYPE_GROUPS.
 */
function groupKey(group: ReportStatGroup): string {
  return [
    group.queueId ?? 'null',
    group.moderatorDid ?? 'null',
    group.reportTypes ? JSON.stringify(group.reportTypes) : 'null',
  ].join('|')
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return toDateString(value)
}
