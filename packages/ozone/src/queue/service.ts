import { type Selectable, sql } from 'kysely'
import type { DatetimeString, DidString, NsidString } from '@atproto/lex'
import { currentDatetimeString, isDidString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import { TimeIdKeyset, paginate } from '../db/pagination.js'
import type { ReportQueue } from '../db/schema/report_queue.js'
import { jsonb } from '../db/types.js'
import { com, tools } from '../lexicons/index.js'
import type { ModerationEventRow } from '../mod-service/types.js'
import { handleReportUpdate } from '../report/handle-report-update.js'
import { ReportStatsService } from '../report/stats.js'
import { viewQueueStats } from '../report/views.js'
import { PolicyListSettingKey } from '../setting/constants.js'
import { resolveReportPriorities } from '../setting/report.js'
import { SettingService } from '../setting/service.js'
import type { ResolvedReportPriority } from '../setting/types.js'
import type { QueueAccess } from './access.js'

type SubjectType = 'account' | 'record' | 'message' | 'conversation'

type ResolvedAssignment = {
  queueId: number
  queuedAt: DatetimeString | null
  status: 'queued' | 'open'
  routingNote?: string
}

type ReportEvent = Pick<
  ModerationEventRow,
  | 'id'
  | 'createdBy'
  | 'subjectDid'
  | 'subjectUri'
  | 'subjectMessageId'
  | 'subjectConvoId'
  | 'meta'
  | 'modTool'
>

function subjectTypeFromEvent(event: ReportEvent): SubjectType {
  if (event.subjectMessageId) return 'message'
  if (event.subjectConvoId) return 'conversation'
  if (event.subjectUri) return 'record'
  return 'account'
}

function reportRowFromEvent({
  event,
  reportType,
  assignment,
  priority,
  createdAt,
  actionEventIds = null,
}: {
  event: ReportEvent
  reportType: string
  assignment: ResolvedAssignment
  priority: ResolvedReportPriority | undefined
  createdAt: DatetimeString
  actionEventIds?: number[] | null
}) {
  let recordPath = ''
  if (event.subjectUri) {
    const uri = new AtUri(event.subjectUri)
    recordPath = `${uri.collection}/${uri.rkey}`
  }

  return {
    eventId: event.id,
    reporterDid: event.createdBy,
    queueId: assignment.queueId,
    queuedAt: assignment.queuedAt,
    actionEventIds: actionEventIds === null ? null : jsonb(actionEventIds),
    actionNote: null,
    isMuted: !!event.meta?.isReporterMuted || !!event.meta?.isSubjectMuted,
    isAutomated: parseModTool(event.modTool).isAutomated,
    status: assignment.status,
    reportType,
    priorityLevel: priority?.level ?? null,
    priorityScore: priority?.score ?? null,
    priorityTargetMinutes: priority?.targetResolutionMinutes ?? null,
    did: event.subjectDid,
    recordPath,
    subjectMessageId: event.subjectMessageId,
    subjectConvoId: event.subjectConvoId,
    createdAt,
    updatedAt: createdAt,
  }
}

/**
 * Find queue to route a report to.
 */
function resolveAssignment(
  subjectType: SubjectType,
  collection: string | null,
  reportType: string,
  queues: Selectable<ReportQueue>[],
  now: DatetimeString,
  explicitQueueId: number | undefined,
  reporterTags: readonly string[],
  accountTags: readonly string[],
): ResolvedAssignment {
  if (explicitQueueId !== undefined) {
    const target = queues.find((q) => q.id === explicitQueueId)
    if (target) return { queueId: target.id, queuedAt: now, status: 'queued' }
    return { queueId: -1, queuedAt: null, status: 'open' }
  }
  const matched = findMatchingQueue(
    queues,
    subjectType,
    collection,
    reportType,
    reporterTags,
    accountTags,
  )
  if (matched) {
    return {
      queueId: matched.id,
      queuedAt: now,
      status: 'queued',
      routingNote: getQueueRoutingNote(matched, reporterTags, accountTags),
    }
  }
  return { queueId: -1, queuedAt: null, status: 'open' }
}

/**
 * Parse routing info from modTool
 */
export function parseModTool(
  modTool: { name: string; meta?: { [_ in string]: unknown } } | null,
): { queueId?: number; isAutomated: boolean } {
  // modTool.meta is untrusted input.
  const queueId =
    typeof modTool?.meta?.queueId === 'number'
      ? modTool.meta.queueId
      : undefined
  const isAutomated = modTool?.meta?.isAutomated === true

  return { queueId, isAutomated }
}

export type QueueServiceCreator = (db: Database) => QueueService

export class QueueService {
  constructor(
    public db: Database,
    private serviceDid: DidString,
  ) {}

  static creator(serviceDid: DidString) {
    return (db: Database) => new QueueService(db, serviceDid)
  }

  /** Insert an immediately routed report in the caller's transaction. */
  async insertReportFromEvent({
    event,
    reportType,
    queueId,
    queuedAt,
    actionEventIds,
    routingNote,
  }: {
    event: ModerationEventRow
    reportType: string
    queueId: number
    queuedAt: DatetimeString | null
    actionEventIds?: number[] | null
    routingNote?: string
  }): Promise<number> {
    this.db.assertTransaction()
    const priorities = await resolveReportPriorities(this.db, [reportType])
    const assignment: ResolvedAssignment = {
      queueId,
      queuedAt,
      status: queueId > 0 ? 'queued' : 'open',
    }
    const inserted = await this.db.db
      .insertInto('report')
      .values(
        reportRowFromEvent({
          event,
          reportType,
          assignment,
          priority: priorities.get(reportType),
          createdAt: event.createdAt,
          actionEventIds,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow()
    if (routingNote) {
      await this.insertRoutingNotes(
        [{ reportId: inserted.id, internalNote: routingNote }],
        event.createdAt,
      )
    }
    return inserted.id
  }

  /**
   * Insert internal routing notes for reports.
   */
  private async insertRoutingNotes(
    notes: { reportId: number; internalNote: string }[],
    createdAt: DatetimeString,
  ): Promise<void> {
    this.db.assertTransaction()
    if (!notes.length) return
    await this.db.db
      .insertInto('report_activity')
      .values(
        notes.map((note) => ({
          ...note,
          activityType: 'noteActivity',
          previousStatus: null,
          publicNote: null,
          meta: null,
          isAutomated: true,
          createdBy: this.serviceDid,
          createdAt,
        })),
      )
      .execute()
  }

  async assertRecommendedPolicies(
    recommendedPolicies: string[],
  ): Promise<void> {
    const { options } = await new SettingService(this.db).query({
      limit: 1,
      scope: 'instance',
      keys: [PolicyListSettingKey],
    })
    const policyList = options[0]?.value
    const validKeys = new Set(
      policyList && typeof policyList === 'object'
        ? Object.keys(policyList)
        : [],
    )
    const invalid = recommendedPolicies.filter((key) => !validKeys.has(key))
    if (invalid.length) {
      throw new InvalidRequestError(
        `Unknown recommended policy keys: ${invalid.join(', ')}`,
        'InvalidRecommendedPolicies',
      )
    }
  }

  async checkConflict({
    name,
    subjectTypes,
    collection,
    reportTypes,
    reporterTags = [],
    accountTags = [],
    recommendedLabels = [],
    excludeId,
  }: {
    name: string
    subjectTypes: string[]
    collection?: NsidString | null
    reportTypes: string[]
    reporterTags?: string[] | null
    accountTags?: string[] | null
    recommendedLabels?: string[]
    excludeId?: number
  }): Promise<void> {
    // It's not ideal to load all rows and perform in memory checks in case we end up with a LOT of queues
    // but we are not foreseeing a lot of queue rows so this should be fine for the
    let qb = this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('deletedAt', 'is', null)

    if (excludeId !== undefined) {
      qb = qb.where('id', '!=', excludeId)
    }

    const existingQueues = await qb.execute()

    for (const existing of existingQueues) {
      if (existing.name === name) {
        throw new InvalidRequestError(
          'A queue with that name already exists',
          'ConflictingQueue',
        )
      }

      const conflictingLabels = recommendedLabels.filter((label) =>
        existing.recommendedLabels.includes(label),
      )
      if (conflictingLabels.length) {
        throw new InvalidRequestError(
          `Recommended labels already belong to queue ${existing.name}: ${conflictingLabels.join(', ')}`,
          'ConflictingQueue',
        )
      }

      // @NOTE Distinct tag roles may overlap; queue IDs determine routing order.
      if (
        !!reporterTags?.length !== !!existing.reporterTags?.length ||
        (!reporterTags?.length &&
          !!accountTags?.length !== !!existing.accountTags?.length)
      ) {
        continue
      }

      const tagged = !!(reporterTags?.length || accountTags?.length)
      const subjectTypesOverlap = subjectTypes.some(
        (st) =>
          existing.subjectTypes.includes(st) &&
          (!tagged ||
            st !== 'record' ||
            collection == null ||
            existing.collection === null ||
            collection === existing.collection),
      )
      const collectionMatch =
        tagged || (collection ?? null) === existing.collection
      const reportTypesOverlap = reportTypes.some((rt) =>
        existing.reportTypes.includes(rt),
      )

      // @NOTE Different tag criteria can still match the same accounts.
      if (subjectTypesOverlap && collectionMatch && reportTypesOverlap) {
        throw new InvalidRequestError(
          `Queue configuration conflicts with existing queue: ${existing.name}`,
          'ConflictingQueue',
        )
      }
    }
  }

  async create({
    name,
    subjectTypes,
    collection,
    reportTypes,
    reporterTags = [],
    accountTags = [],
    description,
    recommendedPolicies,
    recommendedLabels = [],
    createdBy,
    strictAccess = false,
  }: {
    name: string
    subjectTypes: string[]
    collection?: NsidString | null
    reportTypes: string[]
    reporterTags?: string[]
    accountTags?: string[]
    description?: string | null
    recommendedPolicies: string[]
    recommendedLabels?: string[]
    createdBy: DidString | 'admin_token'
    strictAccess?: boolean
  }): Promise<Selectable<ReportQueue>> {
    const now = currentDatetimeString()
    return await this.db.db
      .insertInto('report_queue')
      .values({
        name,
        subjectTypes: jsonb(subjectTypes),
        collection: collection ?? null,
        reportTypes: jsonb(reportTypes),
        reporterTags: jsonb(reporterTags),
        accountTags: jsonb(accountTags),
        description: description ?? null,
        recommendedPolicies: jsonb(recommendedPolicies),
        recommendedLabels: jsonb(recommendedLabels),
        createdBy,
        enabled: true,
        strictAccess,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async getById(
    id: number,
    lock = false,
  ): Promise<Selectable<ReportQueue> | undefined> {
    if (lock) this.db.assertTransaction()
    return await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', '=', id)
      .where('deletedAt', 'is', null)
      .$if(lock, (qb) => qb.forUpdate())
      .executeTakeFirst()
  }

  async getByRecommendedLabel(
    label: string,
  ): Promise<Selectable<ReportQueue> | undefined> {
    const matches = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .where(sql<boolean>`"recommendedLabels" @> ${jsonb([label])}`)
      .limit(2)
      .execute()
    return matches.length === 1 ? matches[0] : undefined
  }

  async getViewsByIds(
    ids: number[],
  ): Promise<Map<number, tools.ozone.queue.defs.QueueView>> {
    if (!ids.length) return new Map()
    const rows = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', 'in', ids)
      .execute()
    return new Map(rows.map((r) => [r.id, this.view(r)]))
  }

  async update(
    id: number,
    updates: {
      name?: string
      enabled?: boolean
      strictAccess?: boolean
      description?: string
      recommendedPolicies?: string[]
      recommendedLabels?: string[]
    },
  ): Promise<Selectable<ReportQueue>> {
    const now = currentDatetimeString()
    return await this.db.db
      .updateTable('report_queue')
      .set({
        ...updates,
        recommendedPolicies:
          updates.recommendedPolicies === undefined
            ? undefined
            : jsonb(updates.recommendedPolicies),
        recommendedLabels:
          updates.recommendedLabels === undefined
            ? undefined
            : jsonb(updates.recommendedLabels),
        updatedAt: now,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async delete(id: number): Promise<void> {
    const now = currentDatetimeString()
    await this.db.db
      .updateTable('report_queue')
      .set({ deletedAt: now })
      .where('id', '=', id)
      .execute()
  }

  async migrateReports(
    fromQueueId: number,
    toQueueId?: number,
  ): Promise<number> {
    const now = currentDatetimeString()
    const results = await this.db.db
      .updateTable('report')
      .set({
        queueId: toQueueId ?? -1,
        queuedAt: toQueueId ? now : null,
        updatedAt: now,
      })
      .where('queueId', '=', fromQueueId)
      .where('status', '!=', 'closed')
      .execute()
    return results.reduce((sum, r) => sum + Number(r.numUpdatedRows), 0)
  }

  async list({
    limit,
    cursor,
    enabled,
    subjectType,
    collection,
    reportTypes,
    access,
  }: {
    limit: number
    access?: QueueAccess
    cursor?: string
    enabled?: boolean
    subjectType?: string
    collection?: NsidString
    reportTypes?: string[]
  }): Promise<{ queues: Selectable<ReportQueue>[]; cursor?: string }> {
    const { ref } = this.db.db.dynamic
    let qb = this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('deletedAt', 'is', null)

    if (access) qb = qb.where(access.filter('report_queue.id'))

    if (enabled !== undefined) {
      qb = qb.where('enabled', '=', enabled)
    }

    if (subjectType !== undefined) {
      qb = qb.where(sql<boolean>`"subjectTypes" @> ${jsonb([subjectType])}`)
    }

    if (collection !== undefined) {
      qb = qb.where('collection', '=', collection)
    }

    if (reportTypes && reportTypes.length > 0) {
      const conditions = reportTypes.map(
        (t) => sql`"reportTypes" @> ${jsonb([t])}`,
      )
      qb = qb.where(sql<boolean>`(${sql.join(conditions, sql` OR `)})`)
    }

    const keyset = new TimeIdKeyset(ref('createdAt'), ref('id'))
    const paginatedBuilder = paginate(qb, {
      limit,
      cursor,
      keyset,
      direction: 'asc',
      tryIndex: true,
    })

    const queues = await paginatedBuilder.execute()

    return {
      queues,
      cursor: keyset.packFromResult(queues),
    }
  }

  view(queue: Selectable<ReportQueue>): tools.ozone.queue.defs.QueueView {
    return {
      id: queue.id,
      name: queue.name,
      subjectTypes: queue.subjectTypes,
      collection: (queue.collection ?? undefined) as NsidString | undefined,
      reportTypes: queue.reportTypes,
      reporterTags: queue.reporterTags ?? [],
      accountTags: queue.accountTags ?? [],
      description: queue.description ?? undefined,
      recommendedPolicies: queue.recommendedPolicies,
      recommendedLabels: queue.recommendedLabels,
      // @ts-expect-error - createdBy can be 'admin_token', which is not a valid value (per lexicon definition)
      createdBy: queue.createdBy,
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
      enabled: queue.enabled,
      strictAccess: queue.strictAccess,
      deletedAt: (queue.deletedAt as DatetimeString | null) ?? undefined,
      stats: {
        pendingCount: 0,
        actionedCount: 0,
        escalatedCount: 0,
        inboundCount: 0,
        actionRate: 0,
      },
    }
  }

  async viewsWithStats(
    queues: Selectable<ReportQueue>[],
  ): Promise<tools.ozone.queue.defs.QueueView[]> {
    const statsService = new ReportStatsService(this.db)
    const queueIds = queues.map((q) => q.id)
    const statsMap = await statsService.getLiveStatsForQueues(queueIds)

    return queues.map((queue) => {
      const view = this.view(queue)
      view.stats = viewQueueStats(statsMap.get(queue.id))
      return view
    })
  }

  /** Load account-level tags once for routing, skipping unused tag criteria. */
  async loadAccountTags(
    queues: Selectable<ReportQueue>[],
    dids: string[],
  ): Promise<Map<string, string[]>> {
    const usesTags = queues.some(
      (queue) =>
        hasTagCriteria(queue) &&
        queue.subjectTypes.length > 0 &&
        queue.reportTypes.length > 0,
    )
    if (!usesTags) return new Map()

    const accountDids = [...new Set(dids.filter(isDidString))]
    if (!accountDids.length) return new Map()

    const accounts = await this.db.db
      .selectFrom('moderation_subject_status')
      .select(['did', 'tags'])
      .where('did', 'in', accountDids)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .execute()
    return new Map(accounts.map((account) => [account.did, account.tags ?? []]))
  }

  /**
   * Re-route unassigned reports and refresh their priority from current settings.
   * Used by the manual `tools.ozone.queue.routeReports` endpoint to pick up
   * reports after queues are created or modified. New reports are inserted
   * by the daemon via `insertReportsFromEvents`, not here.
   */
  async assignReportBatch(
    params: { start: number; end: number; limit: number },
    opts?: { includeUnmatched?: boolean; serviceDid?: DidString },
  ): Promise<{
    processed: number
    assigned: number
    unmatched: number
    maxId: number
  }> {
    return this.db.transaction(async (dbTxn) => {
      const queueService = new QueueService(dbTxn, this.serviceDid)
      const { queues } = await queueService.list({ limit: 1000, enabled: true })

      let query = dbTxn.db
        .selectFrom('report as r')
        .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
        .select([
          'r.id',
          'r.status',
          'r.reportType',
          'r.did',
          'r.reporterDid',
          'r.recordPath',
          'r.subjectMessageId',
          'r.subjectConvoId',
          'me.modTool',
          'me.createdBy as eventReporterDid',
        ])
        .where('r.status', '!=', 'closed')
        .where('r.id', '>=', params.start)
        .where('r.id', '<=', params.end)
        .orderBy('r.id', 'asc')
        .limit(params.limit)
        .forUpdate('r')

      if (opts?.includeUnmatched) {
        query = query.where((eb) =>
          eb.or([eb('r.queueId', 'is', null), eb('r.queueId', '=', -1)]),
        )
      } else {
        query = query.where('r.queueId', 'is', null)
      }

      const reports = await query.execute()

      if (!reports.length) {
        return { processed: 0, assigned: 0, unmatched: 0, maxId: 0 }
      }

      const accountTags = await queueService.loadAccountTags(
        queues,
        reports.flatMap((report) => [
          report.did,
          report.reporterDid ?? report.eventReporterDid,
        ]),
      )
      const priorities = await resolveReportPriorities(
        dbTxn,
        reports.map((report) => report.reportType),
      )
      const prioritiesByType = jsonb(Object.fromEntries(priorities))
      const priorityUpdates = {
        priorityLevel: sql<
          string | null
        >`${prioritiesByType} -> "reportType" ->> 'level'`,
        priorityScore: sql<
          number | null
        >`(${prioritiesByType} -> "reportType" ->> 'score')::integer`,
        priorityTargetMinutes: sql<
          number | null
        >`(${prioritiesByType} -> "reportType" ->> 'targetResolutionMinutes')::integer`,
      }
      const now = currentDatetimeString()

      // Resolve each report's destination in memory — no DB calls in this loop
      type MatchedEntry = {
        id: number
        queueId: number
        nextStatus: string | null
        activity: { activityType: string; previousStatus: string } | null
        routingNote?: string
      }

      const matchedByQueue = new Map<number, MatchedEntry[]>()
      const unmatchedIds: number[] = []
      let maxReportId = 0

      for (const report of reports) {
        const subjectType: SubjectType = report.subjectMessageId
          ? 'message'
          : report.subjectConvoId
            ? 'conversation'
            : report.recordPath
              ? 'record'
              : 'account'

        // recordPath is 'collection/rkey' for records, '' for accounts
        const slashIdx = report.recordPath.indexOf('/')
        const collection =
          slashIdx > 0 ? report.recordPath.slice(0, slashIdx) : null

        const tool = parseModTool(report.modTool)

        const assignment = resolveAssignment(
          subjectType,
          collection,
          report.reportType,
          queues,
          now,
          tool.queueId,
          accountTags.get(report.reporterDid ?? report.eventReporterDid) ?? [],
          accountTags.get(report.did) ?? [],
        )

        if (assignment.queueId !== -1) {
          // Existing-row UPDATE path uses handleReportUpdate so that already
          // escalated/closed/etc. reports keep their status — only open → queued
          // transitions emit a status change and an activity row.
          const result = handleReportUpdate(report.status, { type: 'queue' })
          const group = matchedByQueue.get(assignment.queueId) ?? []
          group.push({
            id: report.id,
            queueId: assignment.queueId,
            nextStatus: result.nextStatus,
            activity: result.activity,
            routingNote: assignment.routingNote,
          })
          matchedByQueue.set(assignment.queueId, group)
        } else {
          unmatchedIds.push(report.id)
        }

        if (report.id > maxReportId) maxReportId = report.id
      }

      // Bulk UPDATE matched reports — split by whether status should change.
      // handleReportUpdate returns nextStatus only for open → queued;
      // other statuses keep their current status but still get routed.
      for (const [queueId, group] of matchedByQueue) {
        const withTransition = group
          .filter((r) => r.nextStatus !== null)
          .map((r) => r.id)
        const withoutTransition = group
          .filter((r) => r.nextStatus === null)
          .map((r) => r.id)

        if (withTransition.length) {
          await dbTxn.db
            .updateTable('report')
            .set({
              ...priorityUpdates,
              queueId,
              queuedAt: now,
              status: 'queued',
              updatedAt: now,
            })
            .where('id', 'in', withTransition)
            .execute()
        }
        if (withoutTransition.length) {
          await dbTxn.db
            .updateTable('report')
            .set({ ...priorityUpdates, queueId, queuedAt: now, updatedAt: now })
            .where('id', 'in', withoutTransition)
            .execute()
        }
      }

      // Bulk UPDATE unmatched reports — status stays unchanged
      if (unmatchedIds.length) {
        await dbTxn.db
          .updateTable('report')
          .set({
            ...priorityUpdates,
            queueId: -1,
            queuedAt: null,
            updatedAt: now,
          })
          .where('id', 'in', unmatchedIds)
          .execute()
      }

      // Bulk INSERT activities for matched reports that changed status.
      if (opts?.serviceDid) {
        const withActivities = [...matchedByQueue.values()]
          .flat()
          .filter((r) => r.activity !== null)
        if (withActivities.length) {
          await dbTxn.db
            .insertInto('report_activity')
            .values(
              withActivities.map((r) => ({
                reportId: r.id,
                activityType: r.activity!.activityType,
                previousStatus: r.activity!.previousStatus,
                internalNote: null,
                publicNote: null,
                meta: null,
                isAutomated: true,
                createdBy: opts.serviceDid!,
                createdAt: now,
              })),
            )
            .execute()
        }
      }

      await queueService.insertRoutingNotes(
        [...matchedByQueue.values()]
          .flat()
          .flatMap((report) =>
            report.routingNote
              ? [{ reportId: report.id, internalNote: report.routingNote }]
              : [],
          ),
        now,
      )

      const assigned = [...matchedByQueue.values()].reduce(
        (sum, g) => sum + g.length,
        0,
      )

      return {
        processed: reports.length,
        assigned,
        unmatched: unmatchedIds.length,
        maxId: maxReportId,
      }
    })
  }

  /**
   * Read newly-created modEventReport rows from `moderation_event` and
   * insert corresponding `report` rows with `queueId` already resolved.
   * Used by the queue-router daemon. On conflict, a null reporter DID is
   * repaired from the source event while existing report state is preserved.
   *
   * Even when no queues are configured, report rows are still inserted with
   * `queueId = -1` so the invariant "every modEventReport has a `report` row"
   * holds.
   * Expected to be called within a database transaction.
   */
  async insertReportsFromEvents(params: {
    cursor: number | null
    limit: number
  }): Promise<{
    processed: number
    assigned: number
    unmatched: number
    maxEventId: number
  }> {
    this.db.assertTransaction()

    const { queues } = await this.list({ limit: 1000, enabled: true })

    let query = this.db.db
      .selectFrom('moderation_event')
      .select([
        'id',
        'createdBy',
        'subjectDid',
        'subjectUri',
        'subjectMessageId',
        'subjectConvoId',
        'meta',
        'modTool',
        'createdAt',
      ])
      .where('action', '=', tools.ozone.moderation.defs.modEventReport.$type)
      .orderBy('id', 'asc')
      .limit(params.limit)

    if (params.cursor !== null) {
      query = query.where('id', '>', params.cursor)
    }

    const events = await query.execute()

    if (!events.length) {
      return { processed: 0, assigned: 0, unmatched: 0, maxEventId: 0 }
    }

    const accountTags = await this.loadAccountTags(
      queues,
      events.flatMap((event) => [event.createdBy, event.subjectDid]),
    )
    const now = currentDatetimeString()
    let maxEventId = 0
    let assigned = 0
    let unmatched = 0

    const reportTypes = events.map(
      (event) =>
        (event.meta?.reportType as string | undefined) ??
        com.atproto.moderation.defs.ReasonOther,
    )
    const priorities = await resolveReportPriorities(this.db, reportTypes)
    const routingNotes = new Map<number, string>()

    const rows = events.map((event) => {
      const subjectType = subjectTypeFromEvent(event)

      let collection: string | null = null
      if (event.subjectUri) {
        const uri = new AtUri(event.subjectUri)
        collection = uri.collection
      }

      const reportType =
        (event.meta?.reportType as string | undefined) ??
        com.atproto.moderation.defs.ReasonOther
      const priority = priorities.get(reportType)

      const tool = parseModTool(event.modTool)

      const assignment = resolveAssignment(
        subjectType,
        collection,
        reportType,
        queues,
        now,
        tool.queueId,
        accountTags.get(event.createdBy) ?? [],
        accountTags.get(event.subjectDid) ?? [],
      )

      if (assignment.queueId === -1) unmatched++
      else assigned++
      if (event.id > maxEventId) maxEventId = event.id
      if (assignment.routingNote) {
        routingNotes.set(event.id, assignment.routingNote)
      }

      return reportRowFromEvent({
        event,
        reportType,
        assignment,
        priority,
        createdAt: now,
      })
    })

    const inserted = await this.db.db
      .insertInto('report')
      .values(rows)
      .onConflict((oc) => oc.column('eventId').doNothing())
      .returning(['id', 'eventId'])
      .execute()

    // @NOTE Keep repairs separate so only new reports receive routing notes.
    if (inserted.length < rows.length) {
      await this.db.db
        .updateTable('report')
        .from('moderation_event as event')
        .set((eb) => ({ reporterDid: eb.ref('event.createdBy') }))
        .whereRef('report.eventId', '=', 'event.id')
        .where(
          'report.eventId',
          'in',
          events.map((event) => event.id),
        )
        .where('report.reporterDid', 'is', null)
        .execute()
    }

    await this.insertRoutingNotes(
      inserted.flatMap((report) => {
        const internalNote = routingNotes.get(report.eventId)
        return internalNote ? [{ reportId: report.id, internalNote }] : []
      }),
      now,
    )

    return {
      processed: events.length,
      assigned,
      unmatched,
      maxEventId,
    }
  }
}

/** Whether a queue requires tags on the reporter or reported account. */
export function hasTagCriteria(queue: Selectable<ReportQueue>): boolean {
  return !!(queue.reporterTags?.length || queue.accountTags?.length)
}

/** Snapshot the mutable tag values that matched an automatic destination. */
export function getQueueRoutingNote(
  queue: Selectable<ReportQueue>,
  reporterTags: readonly string[],
  accountTags: readonly string[],
): string | undefined {
  const matches = [
    ['reporterTags', queue.reporterTags ?? [], reporterTags],
    ['accountTags', queue.accountTags ?? [], accountTags],
  ] as const
  const criteria = matches.flatMap(([field, required, actual]) => {
    const matched = required.filter((tag) => actual.includes(tag))
    return matched.length ? [`${field}: ${JSON.stringify(matched)}`] : []
  })
  if (!criteria.length) return undefined
  return `Automatically routed to queue ${JSON.stringify(queue.name)} (ID ${queue.id}). Matched ${criteria.join('; ')}.`
}

export function findMatchingQueue(
  queues: Selectable<ReportQueue>[],
  subjectType: string,
  collection: string | null,
  reportType: string | undefined,
  reporterTags: readonly string[] = [],
  accountTags: readonly string[] = [],
): Selectable<ReportQueue> | null {
  let matched: Selectable<ReportQueue> | null = null

  for (const queue of queues) {
    if (!queue.enabled || queue.deletedAt !== null) continue

    const subjectTypeMatch = queue.subjectTypes.includes(subjectType)
    const collectionMatch =
      subjectType === 'record' && queue.collection !== null
        ? (collection ?? null) === queue.collection
        : true
    const reportTypeMatch =
      reportType !== undefined && queue.reportTypes.includes(reportType)
    const queueReporterTags = queue.reporterTags ?? []
    const queueAccountTags = queue.accountTags ?? []
    const reporterTagsMatch =
      queueReporterTags.length === 0 ||
      queueReporterTags.some((tag) => reporterTags.includes(tag))
    const accountTagsMatch =
      queueAccountTags.length === 0 ||
      queueAccountTags.some((tag) => accountTags.includes(tag))

    if (
      subjectTypeMatch &&
      collectionMatch &&
      reportTypeMatch &&
      reporterTagsMatch &&
      accountTagsMatch &&
      (matched === null || queue.id < matched.id)
    ) {
      matched = queue
    }
  }

  return matched
}
