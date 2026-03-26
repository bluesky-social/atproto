import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { Report } from '../db/schema/report'
import { QueryParams } from '../lexicon/types/tools/ozone/report/queryReports'
import {
  AlreadyInTargetState,
  InvalidStateTransition,
  handleReportUpdate,
} from '../report/handle-report-update'

export type ReportWithEvent = Omit<Report, 'id'> & {
  id: number
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  reportedBy: string
  comment: string | null
  meta: Record<string, string | boolean | number> | null
}

export type QueryReportsResult = {
  reports: ReportWithEvent[]
  cursor: string | undefined
}
function reportQuery(db: Database) {
  return db.db
    .selectFrom('report as r')
    .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
    .where('me.action', '=', 'tools.ozone.moderation.defs#modEventReport')
}

export async function queryReports(
  db: Database,
  params: QueryParams,
): Promise<QueryReportsResult> {
  let builder = reportQuery(db)

  if (params.queueId !== undefined) {
    builder = builder.where('r.queueId', '=', params.queueId)
  }

  if (params.status) {
    builder = builder.where('r.status', '=', params.status)
  }

  if (params.subject) {
    const isRecord = params.subject.startsWith('at://')
    if (isRecord) {
      const uri = new AtUri(params.subject)
      builder = builder
        .where('me.subjectDid', '=', uri.host)
        .where('me.subjectUri', '=', params.subject)
    } else {
      builder = builder
        .where('me.subjectDid', '=', params.subject)
        .where('me.subjectUri', 'is', null)
    }
  }

  if (params.subjectType) {
    const normalizedType = params.subjectType as 'account' | 'record'
    if (normalizedType === 'account') {
      builder = builder.where('me.subjectUri', 'is', null)
    } else if (normalizedType === 'record') {
      builder = builder.where('me.subjectUri', 'is not', null)
    }
  }

  if (params.collections?.length) {
    // Filter by collection (only applies to records)
    const collectionConditions = params.collections.map(
      (collection) => sql`me."subjectUri" LIKE ${`%/${collection}/%`}`,
    )
    builder = builder.where(sql`(${sql.join(collectionConditions, sql` OR `)})`)
  }

  if (params.reportTypes?.length) {
    // Filter by report types using JSON contains
    const reportTypeConditions = params.reportTypes.map(
      (reportType) => sql`me.meta @> ${JSON.stringify({ reportType })}`,
    )
    builder = builder.where(sql`(${sql.join(reportTypeConditions, sql` OR `)})`)
  }

  if (params.reportedAfter) {
    builder = builder.where('r.createdAt', '>', params.reportedAfter)
  }

  if (params.reportedBefore) {
    builder = builder.where('r.createdAt', '<', params.reportedBefore)
  }

  if (params.reviewedBy) {
    // Filter by moderator who actioned the report
    // Check if any action event IDs belong to events created by the specified moderator
    builder = builder.where(sql`EXISTS (
      SELECT 1 FROM moderation_event AS action_event
      WHERE action_event."createdBy" = ${params.reviewedBy}
      AND action_event.id = ANY(r.actionEventIds)
    )`)
  }

  const sortField = params.sortField ?? 'createdAt'
  const sortDirection = params.sortDirection ?? 'desc'

  builder = builder
    .orderBy(
      sortField === 'updatedAt' ? 'r.updatedAt' : 'r.createdAt',
      sortDirection,
    )
    .orderBy('r.id', 'desc')

  const limit = params.limit ?? 50
  if (params.cursor) {
    const [sortValue, id] = params.cursor.split('::')
    const sortCol = sortField === 'updatedAt' ? 'r.updatedAt' : 'r.createdAt'
    if (sortDirection === 'desc') {
      builder = builder.where(sql`(
        ${sql.ref(sortCol)} < ${sortValue}
        OR (${sql.ref(sortCol)} = ${sortValue} AND r.id < ${Number(id)})
      )`)
    } else {
      builder = builder.where(sql`(
        ${sql.ref(sortCol)} > ${sortValue}
        OR (${sql.ref(sortCol)} = ${sortValue} AND r.id > ${Number(id)})
      )`)
    }
  }

  const reports = await builder
    .selectAll('r')
    .select([
      'me.subjectDid',
      'me.subjectUri',
      'me.subjectCid',
      'me.createdBy as reportedBy',
      'me.comment',
      'me.meta',
    ])
    .limit(limit + 1)
    .execute()

  let cursor: string | undefined
  const hasMore = reports.length > limit
  if (hasMore) {
    const last = reports[limit - 1]
    const sortValue =
      sortField === 'updatedAt' ? last.updatedAt : last.createdAt
    cursor = `${sortValue}::${last.id}`
  }

  const reportsToReturn = hasMore ? reports.slice(0, limit) : reports

  return {
    reports: reportsToReturn,
    cursor,
  }
}

export async function getReportById(
  db: Database,
  id: number,
): Promise<ReportWithEvent | undefined> {
  return reportQuery(db)
    .where('r.id', '=', id)
    .selectAll('r')
    .select([
      'me.subjectDid',
      'me.subjectUri',
      'me.subjectCid',
      'me.createdBy as reportedBy',
      'me.comment',
      'me.meta',
    ])
    .executeTakeFirst()
}

export async function getLatestReport(
  db: Database,
): Promise<ReportWithEvent | undefined> {
  return reportQuery(db)
    .selectAll('r')
    .select([
      'me.subjectDid',
      'me.subjectUri',
      'me.subjectCid',
      'me.createdBy as reportedBy',
      'me.comment',
      'me.meta',
    ])
    .orderBy('r.id', 'desc')
    .limit(1)
    .executeTakeFirst()
}

export type ActiveReportAssignment = {
  did: string
  assignedAt: string
}

export async function getPermanentReportAssignments(
  db: Database,
  reportIds: number[],
): Promise<Map<number, ActiveReportAssignment>> {
  if (!reportIds.length) return new Map()

  const rows = await db.db
    .selectFrom('moderator_assignment')
    .select(['reportId', 'did', 'startAt'])
    .where('reportId', 'in', reportIds)
    .where('endAt', 'is', null)
    .execute()

  const result = new Map<number, ActiveReportAssignment>()
  for (const row of rows) {
    // We already filter by reportId values so reportId will always be non-null, this check is only for ts
    if (row.reportId !== null) {
      result.set(row.reportId, { did: row.did, assignedAt: row.startAt })
    }
  }
  return result
}

export type FindReportsForSubjectParams = {
  subjectDid: string
  subjectUri?: string | null
  reportIds?: number[]
  reportTypes?: string[]
  targetAll?: boolean
}

export type ReportResult = {
  id: number
  eventId: number
  queueId: number | null
  queuedAt: string | null
  actionEventIds: number[] | null
  actionNote: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export async function findReportsForSubject(
  db: Database,
  params: FindReportsForSubjectParams,
): Promise<ReportResult[]> {
  let builder = reportQuery(db).where('me.subjectDid', '=', params.subjectDid)

  // Filter by subject URI (if provided, match exactly; if null/undefined, match repo-level)
  if (params.subjectUri) {
    builder = builder.where('me.subjectUri', '=', params.subjectUri)
  } else {
    builder = builder.where('me.subjectUri', 'is', null)
  }

  if (params.targetAll) {
    // Target all open/escalated reports on the subject
    builder = builder.where('r.status', 'in', ['open', 'escalated'])
  } else if (params.reportIds?.length) {
    // Target specific report IDs — still enforce state transition rules
    builder = builder
      .where('r.id', 'in', params.reportIds)
      .where('r.status', 'in', ['open', 'escalated'])
  } else if (params.reportTypes?.length) {
    // Target reports matching specific report types
    const reportTypeConditions = params.reportTypes.map(
      (reportType) => sql`me.meta @> ${JSON.stringify({ reportType })}`,
    )
    builder = builder
      .where(sql`(${sql.join(reportTypeConditions, sql` OR `)})`)
      .where('r.status', 'in', ['open', 'escalated'])
  } else {
    // No targeting criteria provided
    return []
  }

  const reports = await builder.selectAll('r').execute()

  return reports as ReportResult[]
}

export type ProcessReportActionParams = {
  db: Database
  reportAction: {
    ids?: number[]
    types?: string[]
    all?: boolean
    note?: string
  }
  subjectDid: string
  subjectUri: string | null
  eventId: number
  eventType: string
  createdBy: string
}

/**
 * Validates and processes a report action by:
 * 1. Finding matching reports based on targeting criteria
 * 2. Validating that specified report IDs exist and belong to the subject
 * 3. Bulk-updating reports with the action event ID, note, and status
 * 4. Bulk-inserting a report_activity row for each updated report
 *
 * @throws InvalidRequestError if validation fails
 */
export async function processReportAction(
  params: ProcessReportActionParams,
): Promise<number> {
  const {
    db,
    reportAction,
    subjectDid,
    subjectUri,
    eventId,
    eventType,
    createdBy,
  } = params

  // Find reports matching the criteria
  const matchingReports = await findReportsForSubject(db, {
    subjectDid,
    subjectUri,
    reportIds: reportAction.ids,
    reportTypes: reportAction.types,
    targetAll: reportAction.all,
  })

  // Validate that reports were found for ids and types
  if (matchingReports.length === 0) {
    if (reportAction.ids?.length) {
      throw new Error(
        'No matching reports found for the specified report IDs on this subject',
      )
    } else if (reportAction.types?.length) {
      throw new Error(
        'No matching reports found for the specified report types on this subject',
      )
    }
    // For 'all', it's okay if no reports exist
    return 0
  }

  // Validate that all specified report IDs were found
  if (reportAction.ids?.length) {
    const foundIds = new Set(matchingReports.map((r) => r.id))
    const requestedIds = new Set(reportAction.ids)
    const missingIds = [...requestedIds].filter((id) => !foundIds.has(id))

    if (missingIds.length > 0) {
      throw new Error(
        `Report IDs ${missingIds.join(', ')} do not exist, are already closed, or do not belong to this subject`,
      )
    }
  }

  // Determine per-report transitions via the pure state machine.
  // Skip reports whose current status doesn't allow the transition.
  const validUpdates: {
    id: number
    nextStatus: string
    activityType: string
    previousStatus: string
  }[] = []

  for (const report of matchingReports) {
    try {
      const result = handleReportUpdate(report.status, {
        type: 'event',
        eventType,
      })
      if (result.nextStatus && result.activity) {
        validUpdates.push({
          id: report.id,
          nextStatus: result.nextStatus,
          activityType: result.activity.activityType,
          previousStatus: result.activity.previousStatus,
        })
      }
    } catch (err) {
      if (
        err instanceof AlreadyInTargetState ||
        err instanceof InvalidStateTransition
      ) {
        // Skip reports that can't transition — silent per design
        continue
      }
      throw err
    }
  }

  if (!validUpdates.length) {
    return 0
  }

  const now = new Date().toISOString()
  const updateIds = validUpdates.map((u) => u.id)

  // Bulk UPDATE reports that passed validation
  // All valid reports share the same target status since they come from the
  // same event type, so a single UPDATE is sufficient.
  const status = validUpdates[0].nextStatus
  const closedAt = status === 'closed' ? now : null
  await db.db
    .updateTable('report')
    .set({
      actionEventIds: sql`COALESCE("actionEventIds", '[]'::jsonb) || ${JSON.stringify(eventId)}::jsonb`,
      actionNote: reportAction.note ?? null,
      status,
      updatedAt: now,
      closedAt,
    })
    .where('id', 'in', updateIds)
    .execute()

  // Bulk INSERT one activity per updated report
  await db.db
    .insertInto('report_activity')
    .values(
      validUpdates.map((u) => ({
        reportId: u.id,
        activityType: u.activityType,
        previousStatus: u.previousStatus,
        internalNote: null,
        publicNote: reportAction.note ?? null,
        meta: null,
        isAutomated: false,
        createdBy,
        createdAt: now,
      })),
    )
    .execute()

  return validUpdates.length
}
