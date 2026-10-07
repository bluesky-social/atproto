import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  currentDatetimeString,
} from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import type { InboxNotification } from '../db/schema/inbox_notification.js'
import type { InboxSeen } from '../db/schema/inbox_seen.js'
import type { tools } from '../lexicons/index.js'
import { notificationVisibility } from './notification-visibility.js'
import { getSeenAt } from './seen.js'
import { inboxHasStarted } from './start.js'
import { parseSubjectCursor } from './subjects.js'

export function inboxSection(value: string): InboxSeen['section'] {
  if (value === 'reports' || value === 'subjects' || value === 'accountStatus')
    return value
  throw new InvalidRequestError('Invalid section')
}

export const notificationSection = {
  reportResolved: 'reports',
  reportReopened: 'reports',
  actionTaken: 'subjects',
  actionReversed: 'subjects',
  appealResolved: 'subjects',
  standingChanged: 'accountStatus',
} as const satisfies Record<InboxNotification['reason'], InboxSeen['section']>

export type NotificationInput = {
  recipientDid: DidString
  reason: InboxNotification['reason']
  target: InboxNotification['target']
  sourceKey: string
  createdAt?: DatetimeString
}

/** Batch inserts in the source transaction, with bounded SQL parameter counts. */
export async function createInboxNotifications(
  db: Database,
  notifications: NotificationInput[],
  startAt?: DatetimeString,
): Promise<void> {
  if (!inboxHasStarted(startAt)) return
  const eligible = notifications
    .map((notification) => ({
      ...notification,
      section: notificationSection[notification.reason],
      createdAt: notification.createdAt ?? currentDatetimeString(),
    }))
    .filter((notification) => !startAt || notification.createdAt >= startAt)
  for (let offset = 0; offset < eligible.length; offset += 500) {
    await db.db
      .insertInto('inbox_notification')
      .values(eligible.slice(offset, offset + 500))
      .onConflict((oc) => oc.column('sourceKey').doNothing())
      .execute()
  }
}

/** Pass the same Database wrapper used by the triggering transaction. */
export async function createInboxNotification(
  db: Database,
  notification: NotificationInput,
  startAt?: DatetimeString,
): Promise<void> {
  await createInboxNotifications(db, [notification], startAt)
}

export async function listInboxNotifications(
  db: Database,
  did: DidString,
  params: tools.ozone.inbox.listNotifications.$Params,
  startAt?: DatetimeString,
) {
  if (!inboxHasStarted(startAt)) return { notifications: [], cursor: undefined }
  const limit = params.limit ?? 50
  let query = db.db
    .selectFrom('inbox_notification as n')
    .leftJoin('inbox_seen as s', (join) =>
      join
        .onRef('s.did', '=', 'n.recipientDid')
        .onRef('s.section', '=', 'n.section'),
    )
    .where('n.recipientDid', '=', did)
    .$if(startAt !== undefined, (qb) =>
      qb.where(notificationVisibility(startAt!)),
    )
    .select([
      'n.id',
      'n.reason',
      'n.target',
      'n.section',
      'n.createdAt',
      's.seenAt',
    ])
  const sections: InboxSeen['section'][] = params.section
    ? [inboxSection(params.section)]
    : ['reports', 'subjects', 'accountStatus']
  if (params.section) query = query.where('n.section', '=', sections[0])
  if (params.reasons?.length)
    query = query.where('n.reason', 'in', params.reasons)
  if (params.cursor) {
    const { sortValue, id } = parseSubjectCursor(params.cursor)
    query = query.where(
      sql<boolean>`(n."createdAt", n.id) < (${sortValue}, ${id})`,
    )
  }
  const ordered = (builder: typeof query) =>
    builder
      .orderBy('n.createdAt', 'desc')
      .orderBy('n.id', 'desc')
      .limit(limit + 1)
  let rows: Awaited<ReturnType<typeof query.execute>>
  if (params.unreadOnly) {
    const watermarks = await Promise.all(
      sections.map((section) => getSeenAt(db, did, section)),
    )
    const branches = sections.map((section, index) => {
      let branch = query.where('n.section', '=', section)
      const seenAt = watermarks[index]
      if (seenAt) branch = branch.where('n.createdAt', '>', seenAt)
      // @NOTE Recheck the joined watermark if it advanced between statements.
      branch = branch.where((eb) =>
        eb.or([
          eb('s.seenAt', 'is', null),
          eb('n.createdAt', '>', eb.ref('s.seenAt')),
        ]),
      )
      return db.db.selectFrom(ordered(branch).as('unread')).selectAll()
    })
    // @NOTE Each branch seeks its section index and contributes at most one page.
    let unread = branches[0]
    for (const branch of branches.slice(1)) unread = unread.unionAll(branch)
    rows = await db.db
      .selectFrom(unread.as('notifications'))
      .selectAll()
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .execute()
  } else {
    rows = await ordered(query).execute()
  }
  const page = rows.slice(0, limit)
  return {
    notifications: page.map((row) => ({
      id: row.id,
      reason: row.reason,
      target: row.target,
      isRead: row.seenAt !== null && row.createdAt <= row.seenAt,
      createdAt: row.createdAt,
    })),
    cursor:
      rows.length > limit && page.length
        ? `${page[page.length - 1].createdAt}::${page[page.length - 1].id}`
        : undefined,
  }
}

export async function countUnreadNotifications(
  db: Database,
  did: DidString,
  section: InboxSeen['section'],
  startAt?: DatetimeString,
): Promise<number> {
  if (!inboxHasStarted(startAt)) return 0
  const seenAt = await getSeenAt(db, did, section)
  let query = db.db
    .selectFrom('inbox_notification as n')
    .where('n.recipientDid', '=', did)
    .where('n.section', '=', section)
    .$if(startAt !== undefined, (qb) =>
      qb.where(notificationVisibility(startAt!)),
    )
  if (seenAt) query = query.where('n.createdAt', '>', seenAt)
  if (section === 'accountStatus') {
    return (await query.select('n.id').limit(1).executeTakeFirst()) ? 1 : 0
  }
  return (
    await query
      .select((eb) => eb.fn.count<number>('n.id').as('count'))
      .executeTakeFirstOrThrow()
  ).count
}
