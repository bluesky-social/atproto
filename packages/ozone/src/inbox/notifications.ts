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

export function inboxSection(value: string): InboxSeen['section'] {
  if (value === 'reports' || value === 'subjects' || value === 'accountStatus')
    return value
  throw new InvalidRequestError('Invalid section')
}

export const notificationSection = {
  reportResolved: 'reports',
  reportReopened: 'reports',
  reportNote: 'reports',
  actionTaken: 'subjects',
  actionReversed: 'subjects',
  appealResolved: 'subjects',
  standingChanged: 'accountStatus',
} as const satisfies Record<InboxNotification['reason'], InboxSeen['section']>

/** Pass the same Database wrapper used by the triggering transaction. */
export async function createInboxNotification(
  db: Database,
  {
    recipientDid,
    reason,
    target,
    body,
    sourceKey,
    createdAt = currentDatetimeString(),
  }: {
    recipientDid: DidString
    reason: InboxNotification['reason']
    target: InboxNotification['target']
    body?: string | null
    sourceKey: string
    createdAt?: DatetimeString
  },
): Promise<void> {
  await db.db
    .insertInto('inbox_notification')
    .values({
      recipientDid,
      reason,
      target,
      body: body ?? null,
      sourceKey,
      section: notificationSection[reason],
      createdAt,
    })
    .onConflict((oc) => oc.column('sourceKey').doNothing())
    .execute()
}

export async function listInboxNotifications(
  db: Database,
  did: DidString,
  params: tools.ozone.inbox.listNotifications.$Params,
) {
  const limit = params.limit ?? 50
  let query = db.db
    .selectFrom('inbox_notification as n')
    .leftJoin('inbox_seen as s', (join) =>
      join
        .onRef('s.did', '=', 'n.recipientDid')
        .onRef('s.section', '=', 'n.section'),
    )
    .where('n.recipientDid', '=', did)
    .select([
      'n.id',
      'n.reason',
      'n.target',
      'n.body',
      'n.section',
      'n.createdAt',
      's.seenAt',
    ])
  if (params.section)
    query = query.where('n.section', '=', inboxSection(params.section))
  if (params.reasons?.length)
    query = query.where('n.reason', 'in', params.reasons)
  if (params.unreadOnly) {
    query = query.where((eb) =>
      eb.or([
        eb('s.seenAt', 'is', null),
        eb('n.createdAt', '>', eb.ref('s.seenAt')),
      ]),
    )
  }
  if (params.cursor) {
    const match = /^(.*)::([1-9]\d*)$/.exec(params.cursor)
    if (
      !match ||
      !Number.isSafeInteger(Number(match[2])) ||
      Number.isNaN(Date.parse(match[1]))
    ) {
      throw new InvalidRequestError('Invalid cursor')
    }
    query = query.where(
      sql<boolean>`(n."createdAt", n.id) < (${match[1]}, ${Number(match[2])})`,
    )
  }
  const rows = await query
    .orderBy('n.createdAt', 'desc')
    .orderBy('n.id', 'desc')
    .limit(limit + 1)
    .execute()
  const page = rows.slice(0, limit)
  return {
    notifications: page.map((row) => ({
      id: row.id,
      reason: row.reason,
      target: row.target,
      ...(row.body ? { body: row.body } : {}),
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
  section?: InboxSeen['section'],
): Promise<number> {
  let query = db.db
    .selectFrom('inbox_notification as n')
    .leftJoin('inbox_seen as s', (join) =>
      join
        .onRef('s.did', '=', 'n.recipientDid')
        .onRef('s.section', '=', 'n.section'),
    )
    .where('n.recipientDid', '=', did)
    .where((eb) =>
      eb.or([
        eb('s.seenAt', 'is', null),
        eb('n.createdAt', '>', eb.ref('s.seenAt')),
      ]),
    )
    .select((eb) => eb.fn.count<number>('n.id').as('count'))
  if (section) query = query.where('n.section', '=', section)
  return (await query.executeTakeFirstOrThrow()).count
}
