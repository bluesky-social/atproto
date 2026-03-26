import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { Member } from '../lexicon/types/tools/ozone/team/defs'
import {
  AlreadyInTargetState,
  InvalidStateTransition,
  handleReportUpdate,
} from './handle-report-update'

export type ActivityType =
  | 'queueActivity'
  | 'assignmentActivity'
  | 'escalationActivity'
  | 'closeActivity'
  | 'reopenActivity'
  | 'noteActivity'

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

  return db.transaction(async (dbTxn) => {
    // Lock the report row for the duration of the transaction to prevent
    // concurrent writes from racing on status validation + update.
    const report = await dbTxn.db
      .selectFrom('report')
      .select(['id', 'status'])
      .where('id', '=', reportId)
      .forUpdate()
      .executeTakeFirst()

    if (!report) {
      throw new InvalidRequestError(
        `Report ${reportId} not found`,
        'ReportNotFound',
      )
    }

    let result
    try {
      result = handleReportUpdate(report.status, {
        type: 'activity',
        activityType,
      })
    } catch (err) {
      if (err instanceof AlreadyInTargetState) {
        throw new InvalidRequestError(err.message, 'AlreadyInTargetState')
      }
      if (err instanceof InvalidStateTransition) {
        throw new InvalidRequestError(err.message, 'InvalidStateTransition')
      }
      throw err
    }

    const now = new Date().toISOString()

    if (result.nextStatus !== null) {
      await dbTxn.db
        .updateTable('report')
        .set({ status: result.nextStatus, updatedAt: now })
        .where('id', '=', reportId)
        .execute()
    }

    const [activity] = await dbTxn.db
      .insertInto('report_activity')
      .values({
        reportId,
        activityType,
        previousStatus: result.activity?.previousStatus ?? null,
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

export function formatActivityView(
  activity: {
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
  },
  memberViews?: Map<string, Member>,
) {
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
    moderator: memberViews?.get(activity.createdBy),
    createdAt: activity.createdAt,
  }
}
