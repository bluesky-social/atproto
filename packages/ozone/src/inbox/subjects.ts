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
import type { InboxConfig } from '../config/config.js'
import type { Database } from '../db/index.js'
import type { tools } from '../lexicons/index.js'
import {
  type ModSubject,
  RepoSubject,
  subjectFromStatusRow,
} from '../mod-service/subject.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'
import {
  APPEAL_REASON_TYPE,
  PUBLIC_EVENT_ACTIONS,
  REVERSE_TAKEDOWN,
  eventSubjectFilter,
  reportSubjectFilter,
} from './appeal.js'
import { loadSubject, toActionViews, toSubjectView } from './views.js'

// The list is anchored on the status table's DID index. A status alone does
// not mean an action was taken: reports also create status rows.
const actionMatch = sql<boolean>`e."subjectDid" = s.did AND (
  (s."recordPath" = '' AND e."subjectType" = 'com.atproto.admin.defs#repoRef')
  OR (s."recordPath" <> '' AND e."subjectUri" =
    'at://' || s.did || '/' || s."recordPath")
)`
const publicActions = sql.join(
  PUBLIC_EVENT_ACTIONS.map((action) => sql`${action}`),
)
const firstAction = sql<DatetimeString>`(
  SELECT min(e."createdAt") FROM moderation_event e
  WHERE ${actionMatch} AND e.action IN (${publicActions})
    AND e.action <> ${REVERSE_TAKEDOWN}
)`
const lastAction = sql<DatetimeString>`(
  SELECT max(e."createdAt") FROM moderation_event e
  WHERE ${actionMatch} AND e.action IN (${publicActions})
)`
const lastAppeal = sql<DatetimeString>`(
  SELECT greatest(r."createdAt", r."closedAt") FROM report r
  WHERE r.did = s.did AND r."recordPath" = s."recordPath"
    AND r."subjectMessageId" IS NULL AND r."subjectConvoId" IS NULL
    AND r."reportType" = ${APPEAL_REASON_TYPE}
  ORDER BY r.id DESC LIMIT 1
)`
const createdSort = sql<DatetimeString>`coalesce(${firstAction}, s."createdAt")`
const updatedSort = sql<DatetimeString>`greatest(s."updatedAt", ${lastAction}, ${lastAppeal})`

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
): Promise<{ rows: ModerationSubjectStatusRow[]; cursor?: string }> {
  const field = params.sortField ?? 'updatedAt'
  const direction = params.sortDirection ?? 'desc'
  const limit = params.limit ?? 50
  const sort = field === 'createdAt' ? createdSort : updatedSort
  let query = db.db
    .selectFrom('moderation_subject_status as s')
    .where('s.did', '=', did)
    .where('s.convoId', '=', '')
    .where(
      sql<boolean>`EXISTS (
      SELECT 1 FROM moderation_event e WHERE ${actionMatch}
      AND e.action IN (${publicActions}) AND e.action <> ${REVERSE_TAKEDOWN}
    )`,
    )
    .selectAll('s')
    .select(sort.as('sortValue'))

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
    .selectAll()
    .executeTakeFirst()
  if (!status) return null
  return recordPath ? subjectFromStatusRow(status) : new RepoSubject(did)
}

/** Full public detail, including all actions and a reporter-safe summary. */
export async function getActionedSubjectDetail(
  db: Database,
  subject: ModSubject,
  serviceDid: DidString,
  cfg: InboxConfig,
  seenAt: DatetimeString | null,
): Promise<tools.ozone.inbox.getActionedSubject.$OutputBody | null> {
  const snapshot = await loadSubject(db, subject)
  if (!snapshot.actionCount) return null
  const events = await db.db
    .selectFrom('moderation_event')
    .where((eb) => eventSubjectFilter(eb, subject))
    .where('action', 'in', [...PUBLIC_EVENT_ACTIONS])
    .selectAll()
    .execute()
  const view = toSubjectView({
    subject,
    serviceDid,
    cfg,
    seenAt,
    snapshot: { ...snapshot, events },
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
    actions: toActionViews(events),
  }

  const reports = await db.db
    .selectFrom('report')
    .where((eb) => reportSubjectFilter(eb, subject))
    .where('reportType', '!=', APPEAL_REASON_TYPE)
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
