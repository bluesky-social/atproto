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
export type AggregateStatistics = {
  inboundCount: number
  pendingCount: number
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
export type QueueStatistics = AggregateStatistics
export type ModeratorStatistics = Omit<AggregateStatistics, 'pendingCount'>
export type ReportTypeStatistics = AggregateStatistics
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
  closedCount: string
  actionedCount: string
  acknowledgedCount: string
  escalatedCount: string
  labelActionCount: string
  tagActionCount: string
  takedownActionCount: string
  ahtDurationSec: string | null
  ahtSampleCount: string
  resolutionDurationSec: string | null
  resolutionSampleCount: string
}
type TypeCountRow = {
  reportType: string
  count: string
}
type TypeWindowRow = {
  reportType: string
  inboundCount: string
  closedCount: string
  actionedCount: string
  acknowledgedCount: string
  escalatedCount: string
  labelActionCount: string
  tagActionCount: string
  takedownActionCount: string
  ahtDurationSec: string | null
  ahtSampleCount: string
  resolutionDurationSec: string | null
  resolutionSampleCount: string
}
type ModeratorWindowRow = {
  did: string
  inboundCount: string
  closedCount: string
  actionedCount: string
  acknowledgedCount: string
  escalatedCount: string
  labelActionCount: string
  tagActionCount: string
  takedownActionCount: string
  ahtDurationSec: string | null
  ahtSampleCount: string
  resolutionDurationSec: string | null
  resolutionSampleCount: string
}
type LifecycleWindowRow = {
  closedCount: string
  actionedCount: string
  acknowledgedCount: string
  escalatedCount: string
  labelActionCount: string
  tagActionCount: string
  takedownActionCount: string
  ahtDurationSec: string | null
  ahtSampleCount: string
  resolutionDurationSec: string | null
  resolutionSampleCount: string
}
type StatGroup = 'aggregate' | 'queue' | 'reportType' | 'moderator'
type GroupedLifecycleRow = LifecycleWindowRow & {
  group: StatGroup
  queueId: number | null
  reportType: string | null
  moderatorDid: string | null
}
type ClosureStatsRow = Omit<GroupedLifecycleRow, 'escalatedCount'>
type EscalationStatsRow = Pick<
  GroupedLifecycleRow,
  'group' | 'queueId' | 'reportType' | 'moderatorDid' | 'escalatedCount'
>
type BatchedStats = {
  /** Pending reports across queues */
  queuePending: QueueCountRow[]
  /** Rest of stats across queues */
  queueWindow: QueueWindowRow[]
  /** Pending reports across report types */
  typePending: TypeCountRow[]
  /** Rest of stats across report types */
  typeWindow: TypeWindowRow[]
  /** Stats across moderators */
  moderator: ModeratorWindowRow[]
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
          rowsWritten += await this.materializeDate(yesterday, { force: true })
        }
      } else {
        rowsWritten += await this.materializeDate(yesterday, { force: true })
      }

      const duration = Date.now() - start
      dbLogger.info({ duration }, 'report stats materialization completed')
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
    date: string,
    opts?: { force?: boolean },
  ): Promise<number> {
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
    return rows.length
  }

  /** Fetch all stat rows for a date, keyed by groupKey for O(1) lookup. */
  private async fetchExistingStatsByKey(
    date: string,
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

    // sql queries to be used later
    const closedSelect = sql`
        count(*) as "closedCount",
        count(*) filter (where "actionType" in (
          'tools.ozone.moderation.defs#modEventLabel',
          'tools.ozone.moderation.defs#modEventTag',
          'tools.ozone.moderation.defs#modEventTakedown'
        )) as "actionedCount",
        count(*) filter (where coalesce("actionType", '') not in (
          'tools.ozone.moderation.defs#modEventLabel',
          'tools.ozone.moderation.defs#modEventTag',
          'tools.ozone.moderation.defs#modEventTakedown'
        )) as "acknowledgedCount",
        count(*) filter (where "actionType" = 'tools.ozone.moderation.defs#modEventLabel') as "labelActionCount",
        count(*) filter (where "actionType" = 'tools.ozone.moderation.defs#modEventTag') as "tagActionCount",
        count(*) filter (where "actionType" = 'tools.ozone.moderation.defs#modEventTakedown') as "takedownActionCount",
        coalesce(sum(greatest(0, extract(epoch from ("closedAt"::timestamp - "assignedAt"::timestamp))))
          filter (where "assignedAt" is not null), 0) as "ahtDurationSec",
        count(*) filter (where "assignedAt" is not null) as "ahtSampleCount",
        coalesce(sum(greatest(0, extract(epoch from ("closedAt"::timestamp - "createdAt"::timestamp)))), 0) as "resolutionDurationSec",
        count(*) as "resolutionSampleCount"`
    const closures = sql`
      select r.*, me.action as "actionType"
      from report r
      left join moderation_event me on me.id = case
        when jsonb_array_length(coalesce(r."actionEventIds", '[]'::jsonb)) > 0
        then (r."actionEventIds" ->> (jsonb_array_length(r."actionEventIds") - 1))::integer
      end
      where r."closedAt" >= ${dayStart} and r."closedAt" < ${dayEnd}`
    const escalations = sql`
      from report_activity ra
      join report r on r.id = ra."reportId"
      where ra."activityType" = 'escalationActivity'
        and ra."createdAt" >= ${dayStart} and ra."createdAt" < ${dayEnd}`

    // Cohort queries. This section lists each query by a qualifier and group.
    // Qualifiers are inbound, pending, escalated, and closed reports.
    // Groups are aggregate, queue, report type, and moderator.
    const inboundAggregate = () =>
      this.db.db
        .selectFrom('report')
        .select(sql<string>`count(*)`.as('inboundCount'))
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .executeTakeFirst()
    const inboundByQueue = () =>
      this.db.db
        .selectFrom('report')
        .select([
          sql<number>`coalesce("queueId", -1)`.as('queueId'),
          sql<string>`count(*)`.as('inboundCount'),
        ])
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .groupBy(sql`coalesce("queueId", -1)`)
        .execute()
    const inboundByReportType = () =>
      this.db.db
        .selectFrom('report')
        .select(['reportType', sql<string>`count(*)`.as('inboundCount')])
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .groupBy('reportType')
        .execute()
    const pendingAggregate = () =>
      this.db.db
        .selectFrom('report')
        .select(sql<string>`count(*)`.as('count'))
        .where('status', '!=', 'closed')
        .executeTakeFirst()
    const pendingByQueue = () =>
      this.db.db
        .selectFrom('report')
        .select([
          sql<number>`coalesce("queueId", -1)`.as('queueId'),
          sql<string>`count(*)`.as('count'),
        ])
        .where('status', '!=', 'closed')
        .groupBy(sql`coalesce("queueId", -1)`)
        .execute()
    const pendingByReportType = () =>
      this.db.db
        .selectFrom('report')
        .select(['reportType', sql<string>`count(*)`.as('count')])
        .where('status', '!=', 'closed')
        .groupBy('reportType')
        .execute()
    const escalationsAggregate = () =>
      sql<EscalationStatsRow>`
      select 'aggregate' as "group", null as "queueId",
        null as "reportType", null as "moderatorDid", count(*) as "escalatedCount"
      ${escalations}
    `.execute(this.db.db)
    const escalationsByQueue = () =>
      sql<EscalationStatsRow>`
      select 'queue' as "group", coalesce(r."queueId", -1) as "queueId",
        null as "reportType", null as "moderatorDid", count(*) as "escalatedCount"
      ${escalations} group by coalesce(r."queueId", -1)
    `.execute(this.db.db)
    const escalationsByReportType = () =>
      sql<EscalationStatsRow>`
      select 'reportType' as "group", null as "queueId",
        r."reportType", null as "moderatorDid", count(*) as "escalatedCount"
      ${escalations} group by r."reportType"
    `.execute(this.db.db)
    const escalationsByModerator = () =>
      sql<EscalationStatsRow>`
      select 'moderator' as "group", null as "queueId",
        null as "reportType", r."assignedTo" as "moderatorDid", count(*) as "escalatedCount"
      ${escalations} group by r."assignedTo"
    `.execute(this.db.db)
    const closuresAggregate = () =>
      sql<ClosureStatsRow>`
      with closures as (${closures})
      select 'aggregate' as "group", null as "queueId",
        null as "reportType", null as "moderatorDid", ${closedSelect}
      from closures
    `.execute(this.db.db)
    const closuresByQueue = () =>
      sql<ClosureStatsRow>`
      with closures as (${closures})
      select 'queue' as "group", coalesce("queueId", -1) as "queueId",
        null as "reportType", null as "moderatorDid", ${closedSelect}
      from closures group by coalesce("queueId", -1)
    `.execute(this.db.db)
    const closuresByReportType = () =>
      sql<ClosureStatsRow>`
      with closures as (${closures})
      select 'reportType' as "group", null as "queueId",
        "reportType", null as "moderatorDid", ${closedSelect}
      from closures group by "reportType"
    `.execute(this.db.db)
    const closuresByModerator = () =>
      sql<ClosureStatsRow>`
      with closures as (${closures})
      select 'moderator' as "group", null as "queueId",
        null as "reportType", "assignedTo" as "moderatorDid", ${closedSelect}
      from closures group by "assignedTo"
    `.execute(this.db.db)

    // These queries are independent, so execute them in one database round.
    const [
      inboundAggregateRow,
      inboundByQueueRows,
      inboundByReportTypeRows,
      pendingAggregateRow,
      pendingByQueueRows,
      pendingByReportTypeRows,
      closuresAggregateRows,
      closuresByQueueRows,
      closuresByReportTypeRows,
      closuresByModeratorRows,
      escalationsAggregateRows,
      escalationsByQueueRows,
      escalationsByReportTypeRows,
      escalationsByModeratorRows,
    ] = await Promise.all([
      inboundAggregate(),
      inboundByQueue(),
      inboundByReportType(),
      pendingAggregate(),
      pendingByQueue(),
      pendingByReportType(),
      closuresAggregate(),
      closuresByQueue(),
      closuresByReportType(),
      closuresByModerator(),
      escalationsAggregate(),
      escalationsByQueue(),
      escalationsByReportType(),
      escalationsByModerator(),
    ])

    // Merge closure and escalation stats into a single lifecycle row per group
    const lifecycleQueries = {
      closures: [
        closuresAggregateRows,
        closuresByQueueRows,
        closuresByReportTypeRows,
        closuresByModeratorRows,
      ],
      escalations: [
        escalationsAggregateRows,
        escalationsByQueueRows,
        escalationsByReportTypeRows,
        escalationsByModeratorRows,
      ],
    }
    const lifecycleRows = mergeLifecycleStats(
      lifecycleQueries.closures.flatMap((result) => result.rows),
      lifecycleQueries.escalations.flatMap((result) => result.rows),
    )
    const lifecycleFor = (
      group: StatGroup,
      predicate: (row: GroupedLifecycleRow) => boolean,
    ): LifecycleWindowRow | undefined =>
      lifecycleRows.find((row) => row.group === group && predicate(row))

    // queue groups
    const queueWindow: QueueWindowRow[] = inboundByQueueRows.map((row) => ({
      queueId: row.queueId,
      inboundCount: row.inboundCount,
      ...emptyLifecycleWindow(),
      ...lifecycleFor('queue', (item) => item.queueId === row.queueId),
    }))
    for (const row of lifecycleRows.filter(
      (item) =>
        item.group === 'queue' &&
        !queueWindow.some((window) => window.queueId === item.queueId),
    )) {
      queueWindow.push({
        inboundCount: '0',
        ...row,
        queueId: row.queueId,
      })
    }
    // Inject aggregate as a synthetic row with queueId=null so resolveQueueStats can find it
    const queuePending: QueueCountRow[] = [
      ...pendingByQueueRows,
      { queueId: null, count: pendingAggregateRow?.count ?? '0' },
    ]
    const aggregateLifecycle = lifecycleFor('aggregate', () => true)
    queueWindow.push({
      queueId: null,
      inboundCount: inboundAggregateRow?.inboundCount ?? '0',
      ...emptyLifecycleWindow(),
      ...aggregateLifecycle,
    })

    // report type groups
    const reportTypeWindow: TypeWindowRow[] = inboundByReportTypeRows.map(
      (row) => ({
        reportType: row.reportType,
        inboundCount: row.inboundCount,
        ...emptyLifecycleWindow(),
        ...lifecycleFor(
          'reportType',
          (item) => item.reportType === row.reportType,
        ),
      }),
    )
    for (const row of lifecycleRows.filter(
      (item) =>
        item.group === 'reportType' &&
        item.reportType !== null &&
        !reportTypeWindow.some(
          (window) => window.reportType === item.reportType,
        ),
    )) {
      reportTypeWindow.push({
        inboundCount: '0',
        ...row,
        reportType: row.reportType!,
      })
    }

    // moderator groups
    const moderator: ModeratorWindowRow[] = lifecycleRows
      .filter((row) => row.group === 'moderator' && row.moderatorDid !== null)
      .map((row) => ({ did: row.moderatorDid!, inboundCount: '0', ...row }))

    return {
      queuePending: queuePending,
      queueWindow,
      typePending: pendingByReportTypeRows,
      typeWindow: reportTypeWindow,
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
    return this.resolveWindowStats(num(window?.inboundCount), pendingCount, [
      ...(window ? [window] : []),
    ])
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
    return this.resolveWindowStats(
      sumNum(matchingWindow, 'inboundCount'),
      pendingCount,
      matchingWindow,
    )
  }

  private resolveModeratorStats(
    moderatorDid: string,
    rows: ModeratorWindowRow[],
  ): ModeratorStatistics {
    const row = rows.find((r) => r.did === moderatorDid)
    const { pendingCount: _, ...stats } = this.resolveWindowStats(
      0,
      0,
      row ? [row] : [],
    )
    return stats
  }

  private resolveWindowStats(
    inboundCount: number,
    pendingCount: number,
    rows: LifecycleWindowRow[],
  ): AggregateStatistics {
    const sum = (field: keyof LifecycleWindowRow) => sumNum(rows, field)
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

  /** Build an upsert row from (date, group, stats). */
  private buildUpsertRow(
    date: string,
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
      closedCount: stats.closedCount,
      actionedCount: stats.actionedCount ?? null,
      acknowledgedCount: stats.acknowledgedCount,
      escalatedCount,
      labelActionCount: stats.labelActionCount,
      tagActionCount: stats.tagActionCount,
      takedownActionCount: stats.takedownActionCount,
      ahtDurationSec: stats.ahtDurationSec,
      ahtSampleCount: stats.ahtSampleCount,
      resolutionDurationSec: stats.resolutionDurationSec,
      resolutionSampleCount: stats.resolutionSampleCount,
      actionRate,
      avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
      avgResolutionTimeSec: stats.avgResolutionTimeSec ?? null,
      computedAt: new Date().toISOString(),
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
            closedCount: r.closedCount,
            actionedCount: r.actionedCount,
            acknowledgedCount: r.acknowledgedCount,
            escalatedCount: r.escalatedCount,
            labelActionCount: r.labelActionCount,
            tagActionCount: r.tagActionCount,
            takedownActionCount: r.takedownActionCount,
            ahtDurationSec: r.ahtDurationSec,
            ahtSampleCount: r.ahtSampleCount,
            resolutionDurationSec: r.resolutionDurationSec,
            resolutionSampleCount: r.resolutionSampleCount,
            actionRate: r.actionRate,
            avgHandlingTimeSec: r.avgHandlingTimeSec,
            avgResolutionTimeSec: r.avgResolutionTimeSec,
            computedAt: r.computedAt,
          })
          .execute()
      }
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

function emptyLifecycleWindow(): LifecycleWindowRow {
  return {
    closedCount: '0',
    actionedCount: '0',
    acknowledgedCount: '0',
    escalatedCount: '0',
    labelActionCount: '0',
    tagActionCount: '0',
    takedownActionCount: '0',
    ahtDurationSec: '0',
    ahtSampleCount: '0',
    resolutionDurationSec: '0',
    resolutionSampleCount: '0',
  }
}

function mergeLifecycleStats(
  closures: ClosureStatsRow[],
  escalations: EscalationStatsRow[],
): GroupedLifecycleRow[] {
  const key = (
    row: Pick<
      GroupedLifecycleRow,
      'group' | 'queueId' | 'reportType' | 'moderatorDid'
    >,
  ) => [row.group, row.queueId, row.reportType, row.moderatorDid].join('|')

  const rows = new Map<string, GroupedLifecycleRow>()
  for (const row of closures) {
    rows.set(key(row), { ...row, escalatedCount: '0' })
  }
  for (const row of escalations) {
    const existing = rows.get(key(row))
    rows.set(key(row), {
      ...row,
      ...emptyLifecycleWindow(),
      ...existing,
      escalatedCount: row.escalatedCount,
    })
  }
  return [...rows.values()]
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
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Get the next calendar date string. */
function nextDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return toDateString(d)
}
