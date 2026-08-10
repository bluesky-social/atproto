import { type Selectable, sql } from 'kysely'
import { MINUTE } from '@atproto/common'
import type { Database } from '../db/index.js'
import { ComputedAtIdKeyset, paginate } from '../db/pagination.js'
import type { ReportStat } from '../db/schema/report_stat.js'
import { jsonb } from '../db/types.js'
import { dbLogger } from '../logger.js'

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
  moderatorHandlingDurationSec: number
  moderatorHandlingSampleCount: number
  actionRate?: number
  avgHandlingTimeSec?: number
  avgModeratorHandlingTimeSec?: number
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
  moderatorHandlingDurationSec: Numeric
  moderatorHandlingSampleCount: Numeric
}

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
  moderatorHandlingDurationSec: number | null
  moderatorHandlingSampleCount: number | null
  actionRate: number | null
  avgHandlingTimeSec: number | null
  computedAt: string
}

export class ReportStatsService {
  constructor(public db: Database) {}

  static creator(): ReportStatsServiceCreator {
    return (db: Database) => new ReportStatsService(db)
  }

  async materializeAll(opts?: { force?: boolean }): Promise<{
    rowsWritten: number
  }> {
    try {
      const start = Date.now()
      const today = toDateString(new Date())
      const yesterday = toDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))
      let rowsWritten = await this.materializeDate(today, opts)

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

  private async materializeDate(
    date: string,
    opts?: { force?: boolean },
  ): Promise<number> {
    const groups = await this.enumerateGroups()
    const batched = await this.computeBatchedStats(date)
    const today = toDateString(new Date())
    const isToday = date === today
    const existing = await this.fetchExistingStatsByKey(date)
    const rows: UpsertRow[] = []

    for (const group of groups) {
      try {
        const cached = existing.get(groupKey(group))
        if (!opts?.force && cached) {
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

  private async enumerateGroups(): Promise<ReportStatGroup[]> {
    const [queues, members, reportTypes] = await Promise.all([
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
      this.db.db
        .selectFrom('report')
        .select('reportType')
        .distinct()
        .orderBy('reportType')
        .execute(),
    ])

    return [
      { queueId: null, moderatorDid: null, reportTypes: null },
      ...queues.map((queue) => ({
        queueId: queue.id,
        moderatorDid: null,
        reportTypes: null,
      })),
      { queueId: -1, moderatorDid: null, reportTypes: null },
      ...members.map((member) => ({
        queueId: null,
        moderatorDid: member.did,
        reportTypes: null,
      })),
      ...reportTypes.map((row) => ({
        queueId: null,
        moderatorDid: null,
        reportTypes: [row.reportType],
      })),
    ]
  }

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
      with activity_base as (
        select
          ra.id,
          ra."reportId",
          ra."activityType",
          ra."createdAt",
          coalesce(ra."queueId", -1) as "statQueueId",
          ra."moderatorDid",
          ra."assignmentStartAt",
          r."reportType",
          r."createdAt" as "reportCreatedAt",
          exists (
            select 1
            from jsonb_array_elements_text(coalesce(ra."actionEventIds", '[]'::jsonb)) as linked("eventId")
            join moderation_event me on me.id = linked."eventId"::integer
            where me.action in (
              'tools.ozone.moderation.defs#modEventLabel',
              'tools.ozone.moderation.defs#modEventTag',
              'tools.ozone.moderation.defs#modEventTakedown'
            )
          ) as enforced,
          exists (
            select 1
            from jsonb_array_elements_text(coalesce(ra."actionEventIds", '[]'::jsonb)) as linked("eventId")
            join moderation_event me on me.id = linked."eventId"::integer
            where me.action = 'tools.ozone.moderation.defs#modEventLabel'
          ) as labeled,
          exists (
            select 1
            from jsonb_array_elements_text(coalesce(ra."actionEventIds", '[]'::jsonb)) as linked("eventId")
            join moderation_event me on me.id = linked."eventId"::integer
            where me.action = 'tools.ozone.moderation.defs#modEventTag'
          ) as tagged,
          exists (
            select 1
            from jsonb_array_elements_text(coalesce(ra."actionEventIds", '[]'::jsonb)) as linked("eventId")
            join moderation_event me on me.id = linked."eventId"::integer
            where me.action = 'tools.ozone.moderation.defs#modEventTakedown'
          ) as taken_down,
          not exists (
            select 1
            from report_activity earlier
            where earlier."reportId" = ra."reportId"
              and earlier."activityType" = 'closeActivity'
              and (earlier."createdAt", earlier.id) < (ra."createdAt", ra.id)
          ) as first_close
        from report_activity ra
        join report r on r.id = ra."reportId"
        where ra."createdAt" >= ${dayStart}
          and ra."createdAt" < ${dayEnd}
          and ra."activityType" in ('closeActivity', 'escalationActivity')
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
        count(*) filter (where "activityType" = 'closeActivity') as "closedCount",
        count(*) filter (where "activityType" = 'closeActivity' and enforced) as "actionedCount",
        count(*) filter (where "activityType" = 'closeActivity' and not enforced) as "acknowledgedCount",
        count(*) filter (where "activityType" = 'escalationActivity') as "escalatedCount",
        count(*) filter (where "activityType" = 'closeActivity' and labeled) as "labelActionCount",
        count(*) filter (where "activityType" = 'closeActivity' and tagged) as "tagActionCount",
        count(*) filter (where "activityType" = 'closeActivity' and taken_down) as "takedownActionCount",
        coalesce(sum(greatest(0, extract(epoch from ("createdAt"::timestamp - "reportCreatedAt"::timestamp))))
          filter (where "activityType" = 'closeActivity' and first_close), 0) as "ahtDurationSec",
        count(*) filter (where "activityType" = 'closeActivity' and first_close) as "ahtSampleCount",
        coalesce(sum(greatest(0, extract(epoch from ("createdAt"::timestamp - "assignmentStartAt"::timestamp))))
          filter (where "activityType" = 'closeActivity' and first_close and "assignmentStartAt" is not null), 0)
          as "moderatorHandlingDurationSec",
        count(*) filter (where "activityType" = 'closeActivity' and first_close and "assignmentStartAt" is not null)
          as "moderatorHandlingSampleCount"
      from activity_base
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
      const reportType = group.reportTypes[0]
      return this.resolveStats(
        num(
          batched.typeInbound.find((row) => row.reportType === reportType)
            ?.count,
        ),
        num(
          batched.typePending.find((row) => row.reportType === reportType)
            ?.count,
        ),
        batched.lifecycle.find(
          (row) =>
            row.groupKind === 'reportType' && row.reportType === reportType,
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
    lifecycle: LifecycleRow | undefined,
  ): ReportStatistics {
    const closedCount = num(lifecycle?.closedCount)
    const actionedCount = num(lifecycle?.actionedCount)
    const ahtDurationSec = Math.round(num(lifecycle?.ahtDurationSec))
    const ahtSampleCount = num(lifecycle?.ahtSampleCount)
    const moderatorHandlingDurationSec = Math.round(
      num(lifecycle?.moderatorHandlingDurationSec),
    )
    const moderatorHandlingSampleCount = num(
      lifecycle?.moderatorHandlingSampleCount,
    )

    return {
      inboundCount,
      pendingCount,
      closedCount,
      actionedCount,
      acknowledgedCount: num(lifecycle?.acknowledgedCount),
      escalatedCount: num(lifecycle?.escalatedCount),
      labelActionCount: num(lifecycle?.labelActionCount),
      tagActionCount: num(lifecycle?.tagActionCount),
      takedownActionCount: num(lifecycle?.takedownActionCount),
      ahtDurationSec,
      ahtSampleCount,
      moderatorHandlingDurationSec,
      moderatorHandlingSampleCount,
      actionRate:
        closedCount > 0
          ? Math.round((actionedCount / closedCount) * 100)
          : undefined,
      avgHandlingTimeSec:
        ahtSampleCount > 0
          ? Math.round(ahtDurationSec / ahtSampleCount)
          : undefined,
      avgModeratorHandlingTimeSec:
        moderatorHandlingSampleCount > 0
          ? Math.round(
              moderatorHandlingDurationSec / moderatorHandlingSampleCount,
            )
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
      moderatorHandlingDurationSec: stats.moderatorHandlingDurationSec,
      moderatorHandlingSampleCount: stats.moderatorHandlingSampleCount,
      actionRate: stats.actionRate ?? null,
      avgHandlingTimeSec: stats.avgHandlingTimeSec ?? null,
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
