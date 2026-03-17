import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'

export type ActivityType =
  | 'queueActivity'
  | 'assignmentActivity'
  | 'escalationActivity'
  | 'closeActivity'
  | 'reopenActivity'
  | 'internalNoteActivity'
  | 'publicNoteActivity'

// State-change activity types and the status they transition the report to
const ACTIVITY_TO_STATE: Record<string, string> = {
  queueActivity: 'queued',
  assignmentActivity: 'assigned',
  escalationActivity: 'escalated',
  closeActivity: 'closed',
  reopenActivity: 'open',
}

// For activity types that are only valid from specific source states
const ACTIVITY_VALID_FROM_STATES: Record<string, string[]> = {
  reopenActivity: ['closed'],
}

// Valid state transitions: key = fromState, value = allowed toStates
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['closed', 'escalated', 'queued', 'assigned'],
  closed: ['open'],
  escalated: ['open', 'closed'],
  queued: ['assigned', 'open'],
  assigned: ['open', 'closed', 'escalated'],
}

export type CreateActivityParams = {
  reportId: number
  activityType: ActivityType
  internalNote?: string
  publicNote?: string
  meta?: Record<string, unknown>
  /** Set true for activities created by automated processes (e.g. queue router). */
  isAutomated?: boolean
  createdBy: string
}

export async function createReportActivity(
  db: Database,
  params: CreateActivityParams,
) {
  const {
    reportId,
    activityType,
    internalNote,
    publicNote,
    meta,
    isAutomated = false,
    createdBy,
  } = params

  const toState = ACTIVITY_TO_STATE[activityType] ?? null

  return db.transaction(async (dbTxn) => {
    // Lock the report row for the duration of the transaction to prevent
    // concurrent writes from racing on status validation + update.
    const rows = await sql<{
      id: number
      status: string
    }>`SELECT id, status FROM report WHERE id = ${reportId} FOR UPDATE`.execute(
      dbTxn.db,
    )
    const report = rows.rows[0]

    if (!report) {
      throw new InvalidRequestError(
        `Report ${reportId} not found`,
        'ReportNotFound',
      )
    }

    const previousStatus = report.status
    const now = new Date().toISOString()

    if (toState !== null) {
      const validFromStates = ACTIVITY_VALID_FROM_STATES[activityType]
      if (validFromStates && !validFromStates.includes(previousStatus)) {
        throw new InvalidRequestError(
          `Cannot transition report from '${previousStatus}' to '${toState}'`,
          'InvalidStateTransition',
        )
      }
      if (previousStatus === toState) {
        throw new InvalidRequestError(
          `Report is already in '${toState}' status`,
          'AlreadyInTargetState',
        )
      }
      const allowed = VALID_TRANSITIONS[previousStatus] ?? []
      if (!allowed.includes(toState)) {
        throw new InvalidRequestError(
          `Cannot transition report from '${previousStatus}' to '${toState}'`,
          'InvalidStateTransition',
        )
      }
      await dbTxn.db
        .updateTable('report')
        .set({ status: toState, updatedAt: now })
        .where('id', '=', reportId)
        .execute()
    }

    const [activity] = await dbTxn.db
      .insertInto('report_activity')
      .values({
        reportId,
        activityType,
        previousStatus: toState !== null ? previousStatus : null,
        internalNote: internalNote ?? null,
        publicNote: publicNote ?? null,
        meta: meta ?? null,
        isAutomated,
        createdBy,
        createdAt: now,
      })
      .returningAll()
      .execute()

    return activity
  })
}

export type BulkActivityInsert = {
  reportId: number
  activityType: string
  previousStatus: string | null
  internalNote?: string
  publicNote?: string
  meta?: unknown
  isAutomated: boolean
  createdBy: string
  createdAt: string
}

/**
 * Insert multiple activity rows in a single query. No validation — caller is
 * responsible for correctness and for being inside an appropriate transaction.
 */
export async function bulkInsertReportActivities(
  db: Database,
  activities: BulkActivityInsert[],
) {
  if (!activities.length) return
  await db.db
    .insertInto('report_activity')
    .values(
      activities.map((a) => ({
        reportId: a.reportId,
        activityType: a.activityType,
        previousStatus: a.previousStatus,
        internalNote: a.internalNote ?? null,
        publicNote: a.publicNote ?? null,
        meta: a.meta ?? null,
        isAutomated: a.isAutomated,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
      })),
    )
    .execute()
}

export type ListActivitiesParams = {
  reportId: number
  limit?: number
  cursor?: string
}

export async function listReportActivities(
  db: Database,
  params: ListActivitiesParams,
) {
  const { reportId, limit = 50, cursor } = params

  let builder = db.db
    .selectFrom('report_activity')
    .selectAll()
    .where('reportId', '=', reportId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)

  if (cursor) {
    const cursorId = parseInt(cursor, 10)
    if (!isNaN(cursorId)) {
      builder = builder.where('id', '<', cursorId)
    }
  }

  const rows = await builder.execute()
  const hasMore = rows.length > limit
  const activities = hasMore ? rows.slice(0, limit) : rows

  const nextCursor =
    hasMore && activities.length > 0
      ? String(activities[activities.length - 1].id)
      : undefined

  return { activities, cursor: nextCursor }
}

function buildActivityObject(
  activityType: string,
  previousStatus: string | null,
): { $type: string; [k: string]: unknown } {
  const $type = `tools.ozone.report.defs#${activityType}`
  if (previousStatus !== null) {
    return { $type, previousStatus }
  }
  return { $type }
}

export function formatActivityView(activity: {
  id: number
  reportId: number
  activityType: string
  previousStatus: string | null
  internalNote: string | null
  publicNote: string | null
  meta: unknown
  isAutomated: boolean
  createdBy: string
  createdAt: string
}) {
  return {
    id: activity.id,
    reportId: activity.reportId,
    activity: buildActivityObject(
      activity.activityType,
      activity.previousStatus,
    ),
    internalNote: activity.internalNote ?? undefined,
    publicNote: activity.publicNote ?? undefined,
    meta: (activity.meta as Record<string, unknown>) ?? undefined,
    isAutomated: activity.isAutomated,
    createdBy: activity.createdBy,
    createdAt: activity.createdAt,
  }
}
