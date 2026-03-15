import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'

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
  action: string
  toState?: string
  note?: string
  /** Whether to also update report.status when action is status_change. Defaults to true. */
  updateStatus?: boolean
  /** Set true for activities created by automated processes (e.g. queue router, assignment handler). */
  isAutomated?: boolean
  createdBy: string
}

export async function createReportActivity(
  db: Database,
  params: CreateActivityParams,
) {
  const {
    reportId,
    action,
    toState,
    note,
    updateStatus = true,
    isAutomated = false,
    createdBy,
  } = params

  const report = await db.db
    .selectFrom('report')
    .select(['id', 'status'])
    .where('id', '=', reportId)
    .executeTakeFirst()

  if (!report) {
    throw new InvalidRequestError(
      `Report ${reportId} not found`,
      'ReportNotFound',
    )
  }

  const fromState = report.status
  const now = new Date().toISOString()

  if (action === 'status_change') {
    if (!toState) {
      throw new InvalidRequestError(
        'toState is required when action is status_change',
        'MissingTargetState',
      )
    }
    const allowed = VALID_TRANSITIONS[fromState] ?? []
    if (!allowed.includes(toState)) {
      throw new InvalidRequestError(
        `Cannot transition report from '${fromState}' to '${toState}'`,
        'InvalidStateTransition',
      )
    }
    if (updateStatus) {
      await db.db
        .updateTable('report')
        .set({ status: toState, updatedAt: now })
        .where('id', '=', reportId)
        .execute()
    }
  }

  const [activity] = await db.db
    .insertInto('report_activity')
    .values({
      reportId,
      action,
      fromState: action === 'status_change' ? fromState : null,
      toState: action === 'status_change' ? (toState ?? null) : null,
      note: note ?? null,
      meta: null,
      isAutomated,
      createdBy,
      createdAt: now,
    })
    .returningAll()
    .execute()

  return activity
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

export function formatActivityView(activity: {
  id: number
  reportId: number
  action: string
  fromState: string | null
  toState: string | null
  note: string | null
  meta: unknown
  isAutomated: boolean
  createdBy: string
  createdAt: string
}) {
  return {
    id: activity.id,
    reportId: activity.reportId,
    action: activity.action,
    fromState: activity.fromState ?? undefined,
    toState: activity.toState ?? undefined,
    note: activity.note ?? undefined,
    meta: (activity.meta as Record<string, unknown>) ?? undefined,
    isAutomated: activity.isAutomated,
    createdBy: activity.createdBy,
    createdAt: activity.createdAt,
  }
}
