import { sql } from 'kysely'
import {
  type DatetimeString,
  type DidString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/lex'
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

/** Normalize and advance each requested section independently and monotonically. */
export async function updateSeenAt(
  db: Database,
  did: DidString,
  requestedSections: InboxSeen['section'][],
  requestedSeenAt?: DatetimeString,
): Promise<DatetimeString> {
  const now = currentDatetimeString()
  const requestedAt = requestedSeenAt
    ? toDatetimeString(new Date(requestedSeenAt))
    : now
  const seenAt = requestedAt < now ? requestedAt : now
  const sections = [...new Set(requestedSections)]
  return await db.transaction(async (txn) => {
    // @NOTE Serialize overlapping section updates, including inserts,
    // so requests listing sections in different orders cannot deadlock.
    await sql`select pg_advisory_xact_lock(hashtext(${did}))`.execute(txn.db)
    const existing = await txn.db
      .selectFrom('inbox_seen')
      .select(['section', 'seenAt'])
      .where('did', '=', did)
      .where('section', 'in', sections)
      .execute()
    // @NOTE Normalize legacy rows with the same date rules as new inputs.
    const previous = new Map(
      existing.map((row) => [
        row.section,
        toDatetimeString(new Date(row.seenAt)),
      ]),
    )
    const rows = await txn.db
      .insertInto('inbox_seen')
      .values(
        sections.map((section) => {
          const oldSeenAt = previous.get(section)
          return {
            did,
            section,
            seenAt: oldSeenAt && oldSeenAt > seenAt ? oldSeenAt : seenAt,
          }
        }),
      )
      .onConflict((oc) =>
        oc.columns(['did', 'section']).doUpdateSet({
          seenAt: sql`excluded."seenAt"`,
        }),
      )
      .returning('seenAt')
      .execute()
    // @NOTE Only the earliest watermark is shared by every section.
    return rows.reduce(
      (min, row) => (row.seenAt < min ? row.seenAt : min),
      rows[0].seenAt,
    )
  })
}
