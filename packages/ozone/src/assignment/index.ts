import { Selectable } from 'kysely'
import { ToolsOzoneQueueDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { EndAtIdKeyset, paginate } from '../db/pagination'
import { ModeratorAssignment } from '../db/schema/moderator_assignment'
import { ReportQueue } from '../db/schema/report_queue'
import type * as ToolsOzoneReportDefs from '../lexicon/types/tools/ozone/report/defs'
import type { Member as TeamMember } from '../lexicon/types/tools/ozone/team/defs'
import { QueueService, QueueServiceCreator } from '../queue/service'
import { createReportActivity } from '../report/activity'
import { TeamService, TeamServiceCreator } from '../team'

export interface AssignmentServiceOpts {
  queueDurationMs: number
  reportDurationMs: number
}

// Queue
export interface GetQueueAssignmentsInput {
  onlyActive?: boolean
  queueIds?: number[]
  dids?: string[]
  limit?: number
  cursor?: string
}
export interface AssignQueueInput {
  did: string
  queueId: number
}

// Report
export interface GetReportAssignmentsInput {
  onlyActive?: boolean
  reportIds?: number[]
  queueIds?: number[]
  dids?: string[]
  limit?: number
  cursor?: string
}
export interface AssignReportInput {
  did: string
  reportId: number
  queueId?: number | null
  isPermanent?: boolean
  createdBy?: string
}
export interface UnassignReportInput {
  reportId: number
}

type AssignmentRowWithQueue = Selectable<ModeratorAssignment> & {
  queueName: string | null
  queueSubjectTypes: string[] | null
  queueCollection: string | null
  queueDescription: string | null
  queueReportTypes: string[] | null
  queueCreatedBy: string | null
  queueCreatedAt: string | null
  queueUpdatedAt: string | null
  queueEnabled: boolean | null
  queueDeletedAt: string | null
}

export type AssignmentServiceCreator = (db: Database) => AssignmentService

export class AssignmentService {
  constructor(
    public db: Database,
    public opts: AssignmentServiceOpts,
    private queueService: QueueService,
    private teamService: TeamService,
  ) {}

  static creator(
    opts: AssignmentServiceOpts,
    queueServiceCreator: QueueServiceCreator,
    teamServiceCreator: TeamServiceCreator,
  ): AssignmentServiceCreator {
    return (db: Database) =>
      new AssignmentService(
        db,
        opts,
        queueServiceCreator(db),
        teamServiceCreator(db),
      )
  }

  private async fetchMemberViews(
    dids: string[],
  ): Promise<Map<string, TeamMember>> {
    return this.teamService.viewByDids(dids)
  }

  async getQueueAssignments(input: GetQueueAssignmentsInput): Promise<{
    assignments: ToolsOzoneQueueDefs.AssignmentView[]
    cursor?: string
  }> {
    const { onlyActive, queueIds, dids, limit, cursor } = input
    const { ref } = this.db.db.dynamic

    let query = this.db.db
      .selectFrom('moderator_assignment')
      .leftJoin(
        'report_queue',
        'report_queue.id',
        'moderator_assignment.queueId',
      )
      .selectAll('moderator_assignment')
      .select([
        'report_queue.name as queueName',
        'report_queue.subjectTypes as queueSubjectTypes',
        'report_queue.collection as queueCollection',
        'report_queue.description as queueDescription',
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('reportId', 'is', null)
      .where('queueId', 'is not', null)

    if (onlyActive) {
      query = query.where('endAt', '>', new Date().toISOString())
    }

    if (queueIds?.length) {
      query = query.where('queueId', 'in', queueIds)
    }

    if (dids?.length) {
      query = query.where('did', 'in', dids)
    }

    // use endAt to take advantage of indexes
    // Qualify column refs to avoid ambiguity with the report_queue join
    const keyset = new EndAtIdKeyset(
      ref('moderator_assignment.endAt'),
      ref('moderator_assignment.id'),
    )
    const paginatedQuery = paginate(query, {
      limit,
      cursor,
      keyset,
      direction: 'desc',
      tryIndex: true,
    })

    const results = await paginatedQuery.execute()
    const memberViews = await this.fetchMemberViews(results.map((r) => r.did))

    return {
      assignments: results.map((row) =>
        this.viewQueueAssignment(row, memberViews.get(row.did)),
      ),
      cursor: keyset.packFromResult(results),
    }
  }

  async getReportAssignments(input: GetReportAssignmentsInput): Promise<{
    assignments: ToolsOzoneReportDefs.AssignmentView[]
    cursor?: string
  }> {
    const { onlyActive, reportIds, queueIds, dids, limit, cursor } = input
    const { ref } = this.db.db.dynamic

    let query = this.db.db
      .selectFrom('moderator_assignment')
      .leftJoin(
        'report_queue',
        'report_queue.id',
        'moderator_assignment.queueId',
      )
      .selectAll('moderator_assignment')
      .select([
        'report_queue.name as queueName',
        'report_queue.subjectTypes as queueSubjectTypes',
        'report_queue.collection as queueCollection',
        'report_queue.description as queueDescription',
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('reportId', 'is not', null)

    if (onlyActive) {
      const now = new Date().toISOString()
      query = query.where((qb) =>
        qb.where('endAt', '>', now).orWhere('endAt', 'is', null),
      )
    }

    if (reportIds?.length) {
      query = query.where('reportId', 'in', reportIds)
    }

    if (queueIds?.length) {
      query = query.where('queueId', 'in', queueIds)
    }

    if (dids?.length) {
      query = query.where('did', 'in', dids)
    }

    // Qualify column refs to avoid ambiguity with the report_queue join
    const keyset = new EndAtIdKeyset(
      ref('moderator_assignment.endAt'),
      ref('moderator_assignment.id'),
    )
    const paginatedQuery = paginate(query, {
      limit,
      cursor,
      keyset,
      direction: 'desc',
      tryIndex: true,
    })

    const results = await paginatedQuery.execute()
    const memberViews = await this.fetchMemberViews(results.map((r) => r.did))

    return {
      assignments: results.map((row) =>
        this.viewReportAssignment(row, memberViews.get(row.did)),
      ),
      cursor: keyset.packFromResult(results),
    }
  }

  async assignQueue(
    input: AssignQueueInput,
  ): Promise<ToolsOzoneQueueDefs.AssignmentView> {
    const { did, queueId } = input
    const now = new Date()
    const endAt = new Date(now.getTime() + this.opts.queueDurationMs)

    // Check queue since we aren't using foreign keys
    const queue = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', '=', queueId)
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (!queue) {
      throw new InvalidRequestError('Invalid queue', 'InvalidAssignment')
    }

    // Make assignment
    const result = await this.db.transaction(async (dbTxn) => {
      const existing = await dbTxn.db
        .selectFrom('moderator_assignment')
        .selectAll()
        .where('did', '=', did)
        .where('queueId', '=', queueId)
        .where('reportId', 'is', null)
        .where('endAt', '>', now.toISOString())
        .executeTakeFirst()
      if (existing) {
        const updated = await dbTxn.db
          .updateTable('moderator_assignment')
          .set({
            endAt: endAt.toISOString(),
          })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return updated
      }
      const created = await dbTxn.db
        .insertInto('moderator_assignment')
        .values({
          did,
          queueId,
          startAt: now.toISOString(),
          endAt: endAt.toISOString(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return created
    })

    if (result.queueId === null || result.reportId !== null) {
      throw new Error('Failed to assign moderator to queue')
    }

    const row = await this.db.db
      .selectFrom('moderator_assignment')
      .leftJoin(
        'report_queue',
        'report_queue.id',
        'moderator_assignment.queueId',
      )
      .selectAll('moderator_assignment')
      .select([
        'report_queue.name as queueName',
        'report_queue.subjectTypes as queueSubjectTypes',
        'report_queue.collection as queueCollection',
        'report_queue.description as queueDescription',
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('moderator_assignment.id', '=', result.id)
      .executeTakeFirstOrThrow()

    const memberViews = await this.fetchMemberViews([result.did])
    return this.viewQueueAssignment(row, memberViews.get(result.did))
  }

  async assignReport(
    input: AssignReportInput,
  ): Promise<ToolsOzoneReportDefs.AssignmentView> {
    const { did, reportId, queueId, isPermanent = false } = input
    const now = new Date()

    // Check report and queue since we aren't using foreign keys
    await this.checkReport(reportId)
    if (queueId !== undefined && queueId !== null) {
      await this.checkQueue(queueId)
    }

    // Make assignment
    const result = await this.db.transaction(async (dbTxn) => {
      if (isPermanent) {
        // Check for an existing permanent assignment (endAt IS NULL)
        const permanentExisting = await dbTxn.db
          .selectFrom('moderator_assignment')
          .selectAll()
          .where('reportId', '=', reportId)
          .where('endAt', 'is', null)
          .executeTakeFirst()

        let result: Selectable<ModeratorAssignment>

        if (permanentExisting) {
          if (permanentExisting.did !== did) {
            throw new InvalidRequestError(
              'Report already assigned',
              'AlreadyAssigned',
            )
          }
          // Same user — update queueId if provided
          result = await dbTxn.db
            .updateTable('moderator_assignment')
            .set({ queueId: queueId ?? permanentExisting.queueId ?? null })
            .where('id', '=', permanentExisting.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        } else {
          // Upgrade an existing active (non-permanent) assignment to permanent
          const activeExisting = await dbTxn.db
            .selectFrom('moderator_assignment')
            .selectAll()
            .where('reportId', '=', reportId)
            .where('endAt', '>', now.toISOString())
            .executeTakeFirst()

          if (activeExisting) {
            result = await dbTxn.db
              .updateTable('moderator_assignment')
              .set({
                did,
                endAt: null,
                queueId: queueId ?? activeExisting.queueId ?? null,
              })
              .where('id', '=', activeExisting.id)
              .returningAll()
              .executeTakeFirstOrThrow()
          } else {
            // Create new permanent assignment
            result = await dbTxn.db
              .insertInto('moderator_assignment')
              .values({
                did,
                reportId,
                queueId: queueId,
                startAt: now.toISOString(),
                endAt: null,
              })
              .returningAll()
              .executeTakeFirstOrThrow()
          }
        }

        // Sync denormalized assignment fields on report table
        await dbTxn.db
          .updateTable('report')
          .set({ assignedTo: did, assignedAt: now.toISOString() })
          .where('id', '=', reportId)
          .execute()

        return result
      }

      // Non-permanent: find any active or permanent assignment
      const existing = await dbTxn.db
        .selectFrom('moderator_assignment')
        .selectAll()
        .where('reportId', '=', reportId)
        .where((qb) =>
          qb
            .where('endAt', '>', now.toISOString())
            .orWhere('endAt', 'is', null),
        )
        .executeTakeFirst()

      if (existing) {
        if (existing.did !== did) {
          throw new InvalidRequestError(
            'Report already assigned',
            'AlreadyAssigned',
          )
        }
        // Refresh the expiry unless the assignment is already permanent
        const newEndAt =
          existing.endAt === null
            ? null
            : new Date(now.getTime() + this.opts.reportDurationMs).toISOString()
        return dbTxn.db
          .updateTable('moderator_assignment')
          .set({
            endAt: newEndAt,
            queueId: queueId ?? existing.queueId ?? null,
          })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
      }

      const endAt = new Date(
        now.getTime() + this.opts.reportDurationMs,
      ).toISOString()
      return dbTxn.db
        .insertInto('moderator_assignment')
        .values({
          did,
          reportId,
          queueId: queueId,
          startAt: now.toISOString(),
          endAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    })

    // Log an assignmentActivity ONLY for permanent assignments. Swallow AlreadyInTargetState
    // so that re-assignments (e.g. refreshing expiry) don't throw.
    if (input.isPermanent) {
      try {
        await createReportActivity(this.db, {
          reportId,
          activityType: 'assignmentActivity',
          isAutomated: false,
          createdBy: input.createdBy ?? did,
          meta: { assignedTo: did },
        })
      } catch (err) {
        if (
          err instanceof InvalidRequestError &&
          err.customErrorName === 'AlreadyInTargetState'
        ) {
          // no-op — report already assigned, no state change to record
        } else {
          throw err
        }
      }
    }

    return this.hydrateReportAssignment(result.id)
  }

  async unassignReport(
    input: UnassignReportInput,
  ): Promise<ToolsOzoneReportDefs.AssignmentView> {
    const { reportId } = input
    const now = new Date()

    await this.checkReport(reportId)

    const result = await this.db.transaction(async (dbTxn) => {
      const existing = await dbTxn.db
        .selectFrom('moderator_assignment')
        .selectAll()
        .where('reportId', '=', reportId)
        .where((qb) =>
          qb
            .where('endAt', '>', now.toISOString())
            .orWhere('endAt', 'is', null),
        )
        .executeTakeFirst()

      if (!existing) {
        throw new InvalidRequestError(
          'Report is not assigned',
          'InvalidAssignment',
        )
      }

      const updated = await dbTxn.db
        .updateTable('moderator_assignment')
        .set({ endAt: now.toISOString() })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Clear denormalized assignment fields on report table
      await dbTxn.db
        .updateTable('report')
        .set({ assignedTo: null, assignedAt: null })
        .where('id', '=', reportId)
        .execute()

      return updated
    })

    return this.hydrateReportAssignment(result.id)
  }

  private async checkReport(reportId: number): Promise<void> {
    const report = await this.db.db
      .selectFrom('report')
      .selectAll()
      .where('id', '=', reportId)
      .executeTakeFirst()
    if (!report) {
      throw new InvalidRequestError('Invalid report', 'InvalidAssignment')
    }
  }

  private async checkQueue(queueId: number): Promise<void> {
    const queue = await this.db.db
      .selectFrom('report_queue')
      .selectAll()
      .where('id', '=', queueId)
      .where('enabled', '=', true)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (!queue) {
      throw new InvalidRequestError('Invalid queue', 'InvalidAssignment')
    }
  }

  private async hydrateReportAssignment(
    assignmentId: number,
  ): Promise<ToolsOzoneReportDefs.AssignmentView> {
    const row = await this.db.db
      .selectFrom('moderator_assignment')
      .leftJoin(
        'report_queue',
        'report_queue.id',
        'moderator_assignment.queueId',
      )
      .selectAll('moderator_assignment')
      .select([
        'report_queue.name as queueName',
        'report_queue.subjectTypes as queueSubjectTypes',
        'report_queue.collection as queueCollection',
        'report_queue.description as queueDescription',
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('moderator_assignment.id', '=', assignmentId)
      .executeTakeFirstOrThrow()

    const memberViews = await this.fetchMemberViews([row.did])
    return this.viewReportAssignment(row, memberViews.get(row.did))
  }

  queueFromJoined(
    row: AssignmentRowWithQueue,
  ): Selectable<ReportQueue> | undefined {
    if (row.queueId === null || row.queueName === null) {
      return undefined
    }

    return {
      id: row.queueId,
      name: row.queueName,
      subjectTypes: row.queueSubjectTypes ?? [],
      collection: row.queueCollection,
      reportTypes: row.queueReportTypes ?? [],
      description: row.queueDescription ?? null,
      createdBy: row.queueCreatedBy ?? '',
      createdAt: row.queueCreatedAt ?? '',
      updatedAt: row.queueUpdatedAt ?? '',
      enabled: row.queueEnabled ?? false,
      deletedAt: row.queueDeletedAt,
    }
  }

  viewQueueAssignment(
    row: AssignmentRowWithQueue,
    member?: TeamMember,
  ): ToolsOzoneQueueDefs.AssignmentView {
    const queueService = this.queueService

    const queue = this.queueFromJoined(row)
    const queueView = queue ? queueService.view(queue) : undefined
    if (!queueView) {
      throw new Error('Failed to hydrate queue')
    }

    return {
      id: row.id,
      did: row.did,
      ...(member ? { moderator: member } : {}),
      queue: queueView,
      startAt: row.startAt,
      endAt: row.endAt ?? '',
    }
  }

  viewReportAssignment(
    row: AssignmentRowWithQueue,
    member?: TeamMember,
  ): ToolsOzoneReportDefs.AssignmentView {
    const queueService = this.queueService

    const queue = this.queueFromJoined(row)
    const queueView = queue ? queueService.view(queue) : undefined

    return {
      id: row.id,
      did: row.did,
      ...(member ? { moderator: member } : {}),
      reportId: row.reportId!,
      ...(queueView ? { queue: queueView } : {}),
      startAt: row.startAt,
      ...(row.endAt !== null ? { endAt: row.endAt } : {}),
    }
  }
}
