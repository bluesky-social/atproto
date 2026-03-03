import { ToolsOzoneQueueDefs, ToolsOzoneReportDefs } from '@atproto/api'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Selectable } from 'kysely'
import { Database } from '../db'
import { EndAtIdKeyset, paginate } from '../db/pagination'
import { ModeratorAssignment } from '../db/schema/moderator_assignment'
import { QueueServiceCreator } from '../queue/service'
import { ReportQueue } from '../db/schema/report_queue'

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
}
export interface UnassignReportInput {
  reportId: number
}

type AssignmentRowWithQueue = Selectable<ModeratorAssignment> & {
  queueName: string | null
  queueSubjectTypes: string[] | null
  queueCollection: string | null
  queueReportTypes: string[] | null
  queueCreatedBy: string | null
  queueCreatedAt: string | null
  queueUpdatedAt: string | null
  queueEnabled: boolean | null
  queueDeletedAt: string | null
}

export class AssignmentService {
  constructor(
    public db: Database,
    public opts: AssignmentServiceOpts,
    public queueServiceCreator: QueueServiceCreator,
  ) {}

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

    return {
      assignments: results.map((row) => this.viewQueueAssignment(row)),
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
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('reportId', 'is not', null)

    if (onlyActive) {
      query = query.where('endAt', '>', new Date().toISOString())
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

    return {
      assignments: results.map((row) => this.viewReportAssignment(row)),
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
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('moderator_assignment.id', '=', result.id)
      .executeTakeFirstOrThrow()

    return this.viewQueueAssignment(row)
  }

  async assignReport(
    input: AssignReportInput,
  ): Promise<ToolsOzoneReportDefs.AssignmentView> {
    const { did, reportId, queueId } = input
    const now = new Date()
    const endAt = new Date(now.getTime() + this.opts.reportDurationMs)

    // Check report and queue since we aren't using foreign keys
    await this.checkReport(reportId)
    if (queueId !== undefined && queueId !== null) {
      await this.checkQueue(queueId)
    }

    // Make assignment
    const result = await this.db.transaction(async (dbTxn) => {
      const existing = await dbTxn.db
        .selectFrom('moderator_assignment')
        .selectAll()
        .where('reportId', '=', reportId)
        .where('endAt', '>', now.toISOString())
        .executeTakeFirst()

      if (existing) {
        if (existing.did !== did) {
          throw new InvalidRequestError(
            'Report already assigned',
            'AlreadyAssigned',
          )
        }
        const updated = await dbTxn.db
          .updateTable('moderator_assignment')
          .set({
            endAt: endAt.toISOString(),
            queueId: queueId ?? existing.queueId ?? null,
          })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return updated
      } else {
        const created = await dbTxn.db
          .insertInto('moderator_assignment')
          .values({
            did,
            reportId,
            queueId: queueId,
            startAt: now.toISOString(),
            endAt: endAt.toISOString(),
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        return created
      }
    })

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
        .where('endAt', '>', now.toISOString())
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
        'report_queue.reportTypes as queueReportTypes',
        'report_queue.createdBy as queueCreatedBy',
        'report_queue.createdAt as queueCreatedAt',
        'report_queue.updatedAt as queueUpdatedAt',
        'report_queue.enabled as queueEnabled',
        'report_queue.deletedAt as queueDeletedAt',
      ])
      .where('moderator_assignment.id', '=', assignmentId)
      .executeTakeFirstOrThrow()

    return this.viewReportAssignment(row)
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
      createdBy: row.queueCreatedBy ?? '',
      createdAt: row.queueCreatedAt ?? '',
      updatedAt: row.queueUpdatedAt ?? '',
      enabled: row.queueEnabled ?? false,
      deletedAt: row.queueDeletedAt,
    }
  }

  viewQueueAssignment(
    row: AssignmentRowWithQueue,
  ): ToolsOzoneQueueDefs.AssignmentView {
    const queueService = this.queueServiceCreator(this.db)

    const queue = this.queueFromJoined(row)
    const queueView = queue ? queueService.view(queue) : undefined
    if (!queueView) {
      throw new Error('Failed to hydrate queue')
    }

    return {
      id: row.id,
      did: row.did,
      queue: queueView,
      startAt: row.startAt,
      endAt: row.endAt,
    }
  }

  viewReportAssignment(
    row: AssignmentRowWithQueue,
  ): ToolsOzoneReportDefs.AssignmentView {
    const queueService = this.queueServiceCreator(this.db)

    const queue = this.queueFromJoined(row)
    const queueView = queue ? queueService.view(queue) : undefined

    return {
      id: row.id,
      did: row.did,
      reportId: row.reportId!,
      ...(queueView ? { queue: queueView } : {}),
      startAt: row.startAt,
      endAt: row.endAt,
    }
  }
}
