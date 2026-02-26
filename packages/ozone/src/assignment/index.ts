import { InvalidRequestError } from '@atproto/xrpc-server'
import { Selectable } from 'kysely'
import { Database } from '../db'
import { ModeratorAssignment } from '../db/schema/moderator_assignment'

export interface AssignmentServiceOpts {
  queueDurationMs: number
  reportDurationMs: number
}

// Queue
export interface GetQueueAssignmentsInput {
  onlyActiveAssignments?: boolean
  queueIds?: number[]
  dids?: string[]
}
export interface AssignQueueInput {
  did: string
  queueId: number
}
export interface QueueAssignment {
  id: number
  did: string
  queueId: number
  startAt: string
  endAt: string
}

// Report
export interface GetReportAssignmentsInput {
  onlyActiveAssignments?: boolean
  reportIds?: number[]
  queueIds?: number[]
  dids?: string[]
}
export interface AssignReportInput {
  did: string
  reportId: number
  queueId?: number | null
  assign: boolean
}
export interface ReportAssignment {
  id: number
  did: string
  reportId: number
  queueId?: number
  startAt: string
  endAt: string
}

export class AssignmentService {
  constructor(
    public db: Database,
    public opts: AssignmentServiceOpts,
  ) {}

  async getQueueAssignments(
    input: GetQueueAssignmentsInput,
  ): Promise<QueueAssignment[]> {
    const { onlyActiveAssignments, queueIds, dids } = input

    let query = this.db.db
      .selectFrom('moderator_assignment')
      .selectAll()
      .where('reportId', 'is', null)
      .where('queueId', 'is not', null)

    if (onlyActiveAssignments) {
      query = query.where('endAt', '>', new Date().toISOString())
    }

    if (queueIds?.length) {
      query = query.where('queueId', 'in', queueIds)
    }

    if (dids?.length) {
      query = query.where('did', 'in', dids)
    }

    const results = await query.execute()

    return results.map((row) => this.viewQueue(row))
  }

  async getReportAssignments(
    input: GetReportAssignmentsInput,
  ): Promise<ReportAssignment[]> {
    const { onlyActiveAssignments, reportIds, queueIds, dids } = input

    let query = this.db.db
      .selectFrom('moderator_assignment')
      .selectAll()
      .where('reportId', 'is not', null)

    if (onlyActiveAssignments) {
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

    const results = await query.execute()

    return results.map((row) => this.viewReport(row))
  }

  async assignQueue(input: AssignQueueInput): Promise<QueueAssignment> {
    const { did, queueId } = input
    const now = new Date()
    const endAt = new Date(now.getTime() + this.opts.queueDurationMs)

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

    const row = this.viewQueue(result)

    return row
  }

  async assignReport(input: AssignReportInput): Promise<ReportAssignment> {
    const { did, reportId, queueId, assign } = input
    const now = new Date()
    const endAt = assign
      ? new Date(now.getTime() + this.opts.reportDurationMs)
      : now

    const result = await this.db.transaction(async (dbTxn) => {
      const existing = await dbTxn.db
        .selectFrom('moderator_assignment')
        .selectAll()
        .where('reportId', '=', reportId)
        .where('endAt', '>', now.toISOString())
        .executeTakeFirst()

      if (existing) {
        if (existing.did !== did && assign) {
          throw new InvalidRequestError(
            'Report already assigned',
            'AlreadyAssigned',
          )
        }
        const updated = await dbTxn.db
          .updateTable('moderator_assignment')
          .set({
            did: assign ? did : existing.did,
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

    if (result.reportId === null) {
      throw new Error('Failed to assign moderator to report')
    }

    const row = this.viewReport(result)

    return row
  }

  viewQueue(assignment: Selectable<ModeratorAssignment>): QueueAssignment {
    return {
      id: assignment.id,
      did: assignment.did,
      queueId: assignment.queueId!,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
    }
  }

  viewReport(assignment: Selectable<ModeratorAssignment>): ReportAssignment {
    return {
      id: assignment.id,
      did: assignment.did,
      reportId: assignment.reportId!,
      queueId: assignment.queueId ?? undefined,
      startAt: assignment.startAt,
      endAt: assignment.endAt,
    }
  }
}
