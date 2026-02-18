import { sql } from 'kysely'
import { AtUri } from '@atproto/syntax'
import { Database } from '../db'
import { QueryParams } from '../lexicon/types/tools/ozone/moderation/queryReports'

export async function queryReports(db: Database, params: QueryParams) {
  let builder = db.db
    .selectFrom('report as r')
    .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
    .where('me.action', '=', 'tools.ozone.moderation.defs#modEventReport')

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
