import type { DatetimeString, DidString } from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { InboxSeen } from '../db/schema/inbox_seen.js'

/** Read the authenticated account's watermark for an inbox section. */
export async function getSeenAt(
  db: Database,
  did: DidString,
  section: InboxSeen['section'],
): Promise<DatetimeString | null> {
  const row = await db.db
    .selectFrom('inbox_seen')
    .select('seenAt')
    .where('did', '=', did)
    .where('section', '=', section)
    .executeTakeFirst()
  return row?.seenAt ?? null
}

export function isRead(
  updatedAt: DatetimeString,
  seenAt: DatetimeString | null,
): boolean {
  return seenAt !== null && updatedAt <= seenAt
}
