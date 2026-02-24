import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  AssignmentWebSocketServer,
  AssignmentWebSocketServerOpts,
} from './assignment-ws'
import { Database } from '../db'

export interface AssignmentServiceOpts {
  queueDurationMs: number
  reportDurationMs: number
}

export interface AssignQueueInput {
  did: string
  queueId: number
}

export interface AssignQueueResult {
  id: number
  did: string
  reportId: null
  queueId: number | null
  startAt: string
  endAt: string
}

export interface GetAssignmentsInput {
  type?: 'queue' | 'report'
  onlyActiveAssignments?: boolean
  queueIds?: number[]
  reportIds?: number[]
  dids?: string[]
}

export interface Assignment {
  id: number
  did: string
  reportId: number | null
  queueId: number | null
  startAt: string
  endAt: string
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
  queueId: number | null
  startAt: string
  endAt: string
}

export class AssignmentService {
  public wss?: AssignmentWebSocketServer

  constructor(
    public db: Database,
    public opts: AssignmentServiceOpts,
    wssOpts?: AssignmentWebSocketServerOpts,
  ) {
    if (wssOpts) {
      this.wss = new AssignmentWebSocketServer(this, wssOpts)
    }
  }

  async getAssignments(input: GetAssignmentsInput): Promise<Assignment[]> {
    const { type, onlyActiveAssignments, queueIds, reportIds, dids } = input

    let query = this.db.db.selectFrom('moderator_assignment').selectAll()

    if (onlyActiveAssignments) {
      query = query.where('endAt', '>', new Date())
    }

    if (queueIds?.length) {
      query = query.where('queueId', 'in', queueIds)
    }

    if (reportIds?.length) {
      query = query.where('reportId', 'in', reportIds)
    } else if (type === 'queue') {
      query = query.where('reportId', 'is', null)
    } else if (type === 'report') {
      query = query.where('reportId', 'is not', null)
    }

    if (dids?.length) {
      query = query.where('did', 'in', dids)
    }

    const results = await query.execute()

    return results.map((row) => ({
      id: row.id,
      did: row.did,
      reportId: row.reportId ?? null,
      queueId: row.queueId ?? null,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
    }))
  }

  async assignQueue(input: AssignQueueInput): Promise<AssignQueueResult> {
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
        .where('endAt', '>', now)
        .executeTakeFirst()

      if (existing) {
        const updated = await dbTxn.db
          .updateTable('moderator_assignment')
          .set({ endAt })
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
          startAt: now,
          endAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return created
    })

    const row: AssignQueueResult = {
      id: result.id,
      did: result.did,
      reportId: null,
      queueId: result.queueId ?? null,
      startAt: result.startAt.toISOString(),
      endAt: result.endAt.toISOString(),
    }

    this.wss?.broadcast({
      type: 'queue:assigned',
      queueId: row.queueId!,
    })

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
        .where('endAt', '>', now)
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
            endAt,
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
            queueId: queueId ?? null,
            startAt: now,
            endAt,
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        return created
      }
    })

    const row: ReportAssignment = {
      id: result.id,
      did: result.did,
      reportId: result.reportId!,
      queueId: result.queueId ?? null,
      startAt: result.startAt.toISOString(),
      endAt: result.endAt.toISOString(),
    }

    this.wss?.broadcast({
      type: assign ? 'report:review:started' : 'report:review:ended',
      reportId: row.reportId,
      moderator: { did: row.did },
      queues: row.queueId != null ? [row.queueId] : [],
    })

    return row
  }
}
