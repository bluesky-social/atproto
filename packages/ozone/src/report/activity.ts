import type {
  DatetimeString,
  DidString,
  LexMap,
  Unknown$Type,
} from '@atproto/lex'
import { currentDatetimeString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import { TimeIdKeyset, paginate } from '../db/pagination.js'
import type { tools } from '../lexicons/index.js'
import {
  AlreadyInTargetState,
  InvalidStateTransition,
  handleReportUpdate,
} from './handle-report-update.js'

const VALID_ACTIVITY_TYPES = new Set([
  'queueActivity',
  'assignmentActivity',
  'escalationActivity',
  'closeActivity',
  'reopenActivity',
  'noteActivity',
] as const)

export type ActivityType =
  typeof VALID_ACTIVITY_TYPES extends Set<infer T> ? T : never

export function isActivityType(value: unknown): value is ActivityType {
  return (VALID_ACTIVITY_TYPES as Set<unknown>).has(value)
}

export type CreateActivityParams = {
  /** Exactly one of reportId or eventId must be provided. */
  reportId?: number
  /** Resolves the report created from this report moderation event. */
  eventId?: number
  activityType: ActivityType
  internalNote?: string
  publicNote?: string
  meta?: Record<string, unknown>
  /** Set true for activities created by automated processes (e.g. queue router). */
  isAutomated?: boolean
  createdBy: DidString
}

export async function createReportActivity(
  db: Database,
  params: CreateActivityParams,
) {
  const {
    reportId,
    eventId,
    activityType,
    internalNote,
    publicNote,
    meta,
    isAutomated = false,
    createdBy,
  } = params

  if ((reportId === undefined) === (eventId === undefined)) {
    throw new InvalidRequestError(
      'Exactly one of reportId or eventId must be provided',
    )
  }

  return db.transaction(async (dbTxn) => {
    // Lock the report row for the duration of the transaction to prevent
    // concurrent writes from racing on status validation + update.
    // Report rows have a unique constraint on eventId, so either lookup
    // locks at most one row.
    const report = await dbTxn.db
      .selectFrom('report')
      .select(['id', 'status'])
      .where((eb) =>
        reportId !== undefined
          ? eb('id', '=', reportId)
          : eb('eventId', '=', eventId ?? -1),
      )
      .forUpdate()
      .executeTakeFirst()

    if (!report) {
      throw new InvalidRequestError(
        reportId !== undefined
          ? `Report ${reportId} not found`
          : `Report for event ${eventId} not found`,
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

    const now = currentDatetimeString()

    if (result.nextStatus !== null) {
      const updateSet: Record<string, string | null> = {
        status: result.nextStatus,
        updatedAt: now,
      }
      if (result.nextStatus === 'closed') {
        updateSet.closedAt = now
      } else if (result.nextStatus === 'open') {
        updateSet.closedAt = null
      }
      await dbTxn.db
        .updateTable('report')
        .set(updateSet)
        .where('id', '=', report.id)
        .execute()
    }

    const [activity] = await dbTxn.db
      .insertInto('report_activity')
      .values({
        reportId: report.id,
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
  createdBy: DidString
  createdAt: DatetimeString
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

export async function queryReportActivities(
  db: Database,
  params: tools.ozone.report.queryActivities.$Params,
) {
  const {
    activityTypes,
    createdAfter,
    createdBefore,
    sortDirection,
    limit,
    cursor,
  } = params
  const { ref } = db.db.dynamic

  let builder = db.db.selectFrom('report_activity').selectAll()

  if (activityTypes && activityTypes.length > 0) {
    builder = builder.where('activityType', 'in', activityTypes)
  }
  if (createdAfter) {
    builder = builder.where('createdAt', '>=', createdAfter)
  }
  if (createdBefore) {
    builder = builder.where('createdAt', '<=', createdBefore)
  }

  const keyset = new TimeIdKeyset(
    ref('report_activity.createdAt'),
    ref('report_activity.id'),
  )
  const paginatedBuilder = paginate(builder, {
    limit,
    cursor,
    keyset,
    direction: sortDirection,
    tryIndex: true,
  })

  const activities = await paginatedBuilder.execute()
  return { activities, cursor: keyset.packFromResult(activities) }
}

function buildActivityObject(
  activityType: string,
  previousStatus: string | null,
): tools.ozone.report.defs.ReportActivityView['activity'] {
  const $type = `tools.ozone.report.defs#${activityType}` as Unknown$Type
  return (
    previousStatus !== null ? { $type, previousStatus } : { $type }
  ) as tools.ozone.report.defs.ReportActivityView['activity']
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
    createdBy: DidString
    createdAt: DatetimeString
  },
  memberViews?: Map<string, tools.ozone.team.defs.Member>,
  reportViews?: Map<number, tools.ozone.report.defs.ReportView>,
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
    meta: (activity.meta as LexMap) ?? undefined,
    isAutomated: activity.isAutomated,
    createdBy: activity.createdBy,
    moderator: memberViews?.get(activity.createdBy),
    report: reportViews?.get(activity.reportId),
    createdAt: activity.createdAt,
  }
}
