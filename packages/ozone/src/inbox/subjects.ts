import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  isAtUriString,
  isDatetimeString,
  isDidString,
  toDatetimeString,
} from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { DEFAULT_INBOX_POLICY_URL } from '../config/config.js'
import type { InboxConfig } from '../config/config.js'
import type { Database } from '../db/index.js'
import { com, type tools } from '../lexicons/index.js'
import {
  type ModSubject,
  RepoSubject,
  subjectFromStatusRow,
} from '../mod-service/subject.js'
import {
  APPEALABLE_EVENT_ACTIONS,
  APPEAL_REASON_TYPE,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  reportSubjectFilter,
} from './appeal.js'
import { queryActionHistory } from './history.js'
import { loadPolicyList } from './policies.js'
import { inboxHasStarted } from './start.js'
import {
  type PublicStatusRow,
  loadSubject,
  publicStatusSelection,
  toSubjectView,
} from './views.js'

export type ActionedSubjectRow = PublicStatusRow & {
  actionCount: number
  firstActionAt: DatetimeString
  lastActionAt: DatetimeString
  latestAppealableAt: DatetimeString | null
}

export function parseSubjectCursor(cursor: string): {
  sortValue: DatetimeString
  id: number
} {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)::([1-9]\d*)$/.exec(
    cursor,
  )
  if (
    !match ||
    !isDatetimeString(match[1]) ||
    !Number.isSafeInteger(Number(match[2]))
  ) {
    throw new InvalidRequestError('Invalid cursor')
  }
  return { sortValue: match[1], id: Number(match[2]) }
}

/** Page actioned subjects owned by one authenticated DID. */
export async function queryActionedSubjects(
  db: Database,
  did: DidString,
  params: Partial<tools.ozone.inbox.listActionedSubjects.$Params>,
  seenAt: DatetimeString | null = null,
  startAt?: DatetimeString,
): Promise<{ rows: ActionedSubjectRow[]; cursor?: string }> {
  if (!inboxHasStarted(startAt)) return { rows: [] }
  const field = params.sortField ?? 'updatedAt'
  const direction = params.sortDirection ?? 'desc'
  const limit = params.limit ?? 50
  // @NOTE Match toSubjectView's public timestamp, including appeal activity.
  const updatedAt = sql<DatetimeString>`greatest(s."updatedAt", a."lastActionAt", r."updatedAt", CASE WHEN r."recordPath" IS NOT NULL THEN coalesce(s."lastAppealedAt", r."createdAt") END, CASE WHEN r.status = 'closed' THEN r."closedAt" END)`
  const sort =
    field === 'createdAt' ? sql<DatetimeString>`a."firstActionAt"` : updatedAt
  // @NOTE Aggregate the DID's history once, rather than rescanning it for
  // every status row before LIMIT. Exact history-derived sorting needs all
  // of this DID's public actions, but never another account's events.
  let query = db.db
    .with(
      (cte) => cte('inbox_actions').materialized(),
      (qb) =>
        qb
          .selectFrom('moderation_event')
          .where('subjectDid', '=', did)
          .where('subjectType', 'in', [
            com.atproto.admin.defs.repoRef.$type,
            com.atproto.repo.strongRef.$type,
          ])
          .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
          .$if(startAt !== undefined, (qb) =>
            qb.where('createdAt', '>=', startAt!),
          )
          .select([
            sql<string>`coalesce("subjectUri", "subjectDid")`.as('subject'),
            sql<number>`count(*) FILTER (WHERE action <> ${REVERSE_TAKEDOWN})::int`.as(
              'actionCount',
            ),
            sql<DatetimeString>`min("createdAt") FILTER (WHERE action <> ${REVERSE_TAKEDOWN})`.as(
              'firstActionAt',
            ),
            sql<DatetimeString>`max("createdAt")`.as('lastActionAt'),
            sql<DatetimeString | null>`max("createdAt") FILTER (WHERE action IN (${sql.join(APPEALABLE_EVENT_ACTIONS)}))`.as(
              'latestAppealableAt',
            ),
          ])
          .groupBy(sql`coalesce("subjectUri", "subjectDid")`),
    )
    .with('inbox_appeals', (qb) =>
      qb
        .selectFrom('report')
        .where('did', '=', did)
        .where('reportType', '=', APPEAL_REASON_TYPE)
        .where('subjectMessageId', 'is', null)
        .where('subjectConvoId', 'is', null)
        .distinctOn('recordPath')
        .select(['recordPath', 'status', 'createdAt', 'updatedAt', 'closedAt'])
        .orderBy('recordPath')
        .orderBy('id', 'desc'),
    )
    .selectFrom('moderation_subject_status as s')
    .innerJoin('inbox_actions as a', (join) =>
      join.on(
        'a.subject',
        '=',
        sql<string>`CASE WHEN s."recordPath" = '' THEN s.did ELSE 'at://' || s.did || '/' || s."recordPath" END`,
      ),
    )
    .leftJoin('inbox_appeals as r', (join) =>
      join
        .onRef('r.recordPath', '=', 's.recordPath')
        .$call((jb) => (startAt ? jb.on('r.createdAt', '>=', startAt) : jb)),
    )
    .where('s.did', '=', did)
    .where('s.convoId', '=', '')
    .where('a.actionCount', '>', 0)
    .select(publicStatusSelection.map((column) => `s.${column}` as const))
    .select([
      'a.actionCount',
      'a.firstActionAt',
      'a.lastActionAt',
      'a.latestAppealableAt',
    ])
    .select(sort.as('sortValue'))

  if (params.filter === 'pending')
    query = query.where('r.status', '!=', 'closed')
  if (params.filter === 'resolved')
    query = query.where('r.status', '=', 'closed')
  if (params.filter === 'unread' && seenAt) {
    query = query.where(updatedAt, '>', seenAt)
  }
  if (params.cursor) {
    const { sortValue, id } = parseSubjectCursor(params.cursor)
    query = query.where(
      direction === 'desc'
        ? sql<boolean>`(${sort}, s.id) < (${sortValue}, ${id})`
        : sql<boolean>`(${sort}, s.id) > (${sortValue}, ${id})`,
    )
  }
  const rows = await query
    .orderBy('sortValue', direction)
    .orderBy('s.id', direction)
    .limit(limit + 1)
    .execute()
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    rows: page,
    cursor: hasMore && last ? `${last.sortValue}::${last.id}` : undefined,
  }
}

/** Resolve a DID or record URI only within the authenticated account. */
export async function findActionedSubject(
  db: Database,
  did: DidString,
  input: string,
): Promise<ModSubject | null> {
  let recordPath = ''
  if (isDidString(input)) {
    if (input !== did) return null
  } else if (isAtUriString(input)) {
    const uri = new AtUri(input)
    if (uri.did !== did || !uri.collection || !uri.rkey) return null
    recordPath = `${uri.collection}/${uri.rkey}`
  } else {
    return null
  }
  const status = await db.db
    .selectFrom('moderation_subject_status')
    .where('did', '=', did)
    .where('recordPath', '=', recordPath)
    .where('convoId', '=', '')
    .select(['did', 'recordPath', 'recordCid', 'blobCids', 'convoId'])
    .executeTakeFirst()
  if (!status) return null
  return recordPath ? subjectFromStatusRow(status) : new RepoSubject(did)
}

/** Public detail with a page of actions and a reporter-safe summary. */
export async function getActionedSubjectDetail(
  db: Database,
  subject: ModSubject,
  serviceDid: DidString,
  cfg: InboxConfig,
  seenAt: DatetimeString | null,
  params: { limit?: number; cursor?: string } = {},
): Promise<tools.ozone.inbox.getActionedSubject.$OutputBody | null> {
  const before = params.cursor ? parseSubjectCursor(params.cursor) : undefined
  const [snapshot, policyList] = await Promise.all([
    loadSubject(db, subject, cfg.startAt),
    loadPolicyList(db, serviceDid),
  ])
  if (!snapshot.actionCount) return null
  const history = await queryActionHistory(
    db,
    subject,
    params.limit ?? 50,
    before,
    policyList,
    cfg.policyDefaultUrl ?? DEFAULT_INBOX_POLICY_URL,
    cfg.startAt,
  )
  const view = toSubjectView({
    subject,
    serviceDid,
    cfg,
    seenAt,
    snapshot,
    policyList,
  })
  if (!view) return null
  const {
    $type: _type,
    latestAction: _latestAction,
    actionCount: _actionCount,
    ...base
  } = view
  const detail: tools.ozone.inbox.getActionedSubject.$OutputBody = {
    ...base,
    actions: history.actions,
    cursor: history.cursor,
  }

  const reportRows = db.db
    .selectFrom('report')
    .where((eb) => reportSubjectFilter(eb, subject))
    .where('reportType', '!=', APPEAL_REASON_TYPE)
    .$if(cfg.startAt !== undefined, (qb) =>
      qb.where('createdAt', '>=', cfg.startAt!),
    )
    .select(['reportType', 'createdAt'])
  // @NOTE The subject indexes are partial by status. Keep each branch's
  // predicate explicit so both active and closed history use those indexes.
  const reports = await db.db
    .selectFrom(
      reportRows
        .where(sql<boolean>`status != 'closed'`)
        .unionAll(reportRows.where(sql<boolean>`status = 'closed'`))
        .as('reports'),
    )
    .select([
      sql<string[]>`array_agg(DISTINCT "reportType")`.as('reasonTypes'),
      sql<DatetimeString | null>`min("createdAt")`.as('firstReportedAt'),
      sql<DatetimeString | null>`max("createdAt")`.as('lastReportedAt'),
    ])
    .executeTakeFirstOrThrow()
  if (reports.firstReportedAt && reports.lastReportedAt) {
    const day = (at: DatetimeString) =>
      toDatetimeString(new Date(`${at.slice(0, 10)}T00:00:00.000Z`))
    detail.reports = {
      reasonTypes: reports.reasonTypes,
      firstReportedOn: day(reports.firstReportedAt),
      lastReportedOn: day(reports.lastReportedAt),
    }
  }
  return detail
}
