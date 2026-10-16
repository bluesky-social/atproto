import type { Selectable } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import { currentDatetimeString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import type { Database } from '../db/index.js'
import type { ExpiringTag } from '../db/schema/expiring_tag.js'
import { tools } from '../lexicons/index.js'
import type { ModerationSubjectStatusRow } from './types.js'

export type ExpiringTagRow = Selectable<ExpiringTag>

export type ExpiringTagGroup = {
  did: DidString
  recordPath: string
  convoId: string
  createdBy: DidString
  tags: string[]
  ids: number[]
}

/** Lock before allocating a tag event ID, reserving a status for new subjects. */
export async function lockTagSubject(
  db: Database,
  params: {
    did: DidString
    recordPath: string
    convoId: string
    recordCid?: string | null
  },
): Promise<number | undefined> {
  db.assertTransaction()
  const statusQuery = db.db
    .selectFrom('moderation_subject_status')
    .where('did', '=', params.did)
    .where('recordPath', '=', params.recordPath)
    .where('convoId', '=', params.convoId)
    .select('id')
    .forUpdate()
  if (await statusQuery.executeTakeFirst()) return

  const now = currentDatetimeString()
  const inserted = await db.db
    .insertInto('moderation_subject_status')
    .values({
      did: params.did,
      recordPath: params.recordPath,
      convoId: params.convoId,
      recordCid: params.recordCid ?? null,
      reviewState: tools.ozone.moderation.defs.reviewNone.value,
      ageAssuranceState: 'unknown',
      takendown: false,
      createdAt: now,
      updatedAt: now,
    } as ModerationSubjectStatusRow)
    .onConflict((oc) =>
      oc.constraint('moderation_status_unique_idx').doNothing(),
    )
    .returning('id')
    .executeTakeFirst()
  // @NOTE a concurrent first report or tag write may have created the row.
  if (!inserted) await statusQuery.executeTakeFirstOrThrow()
  return inserted?.id
}

export async function insertExpiringTags(
  db: Database,
  params: {
    eventId: number
    did: DidString
    recordPath: string
    convoId: string
    tags: string[]
    expiresAt: DatetimeString
    createdBy: DidString
  },
): Promise<void> {
  if (!params.tags.length) return
  await db.db
    .insertInto('expiring_tag')
    .values(
      params.tags.map((tag) => ({
        eventId: params.eventId,
        did: params.did,
        recordPath: params.recordPath,
        convoId: params.convoId,
        tag,
        expiresAt: params.expiresAt,
        createdBy: params.createdBy,
      })),
    )
    .execute()
}

export async function removeExpiringTags(
  db: Database,
  params: {
    did: DidString
    recordPath: string
    convoId: string
    tags: string[]
  },
): Promise<void> {
  if (!params.tags.length) return
  const recordPaths = [params.recordPath]
  if (params.recordPath) {
    // @NOTE older record expiry rows stored the full URI.
    recordPaths.push(`at://${params.did}/${params.recordPath}`)
  }
  await db.db
    .deleteFrom('expiring_tag')
    .where('did', '=', params.did)
    .where('recordPath', 'in', recordPaths)
    .where('convoId', '=', params.convoId)
    .where('tag', 'in', params.tags)
    .execute()
}

export async function deleteExpiringTagsByIds(
  db: Database,
  ids: number[],
): Promise<void> {
  await db.db.deleteFrom('expiring_tag').where('id', 'in', ids).execute()
}

/** Return one bounded batch of due tag rows, grouped for reversal. */
export async function getExpiredTags(
  db: Database,
): Promise<ExpiringTagGroup[]> {
  const now = currentDatetimeString()
  const rows = await db.db
    .selectFrom('expiring_tag')
    .where('expiresAt', '<=', now)
    .orderBy('expiresAt', 'asc')
    .limit(1_000)
    .selectAll()
    .execute()

  if (!rows.length) return []

  // Group by (did, recordPath, convoId, createdBy) so each reversal event has the correct author
  const grouped = new Map<string, ExpiringTagGroup>()
  for (const row of rows) {
    const uri = row.recordPath.startsWith('at://')
      ? new AtUri(row.recordPath)
      : undefined
    const recordPath = uri ? `${uri.collection}/${uri.rkey}` : row.recordPath
    const key = `${row.did}|${recordPath}|${row.convoId}|${row.createdBy}`
    let group = grouped.get(key)
    if (!group) {
      group = {
        did: row.did,
        recordPath,
        convoId: row.convoId,
        createdBy: row.createdBy,
        tags: [],
        ids: [],
      }
      grouped.set(key, group)
    }
    if (!group.tags.includes(row.tag)) {
      group.tags.push(row.tag)
    }
    group.ids.push(row.id)
  }

  return [...grouped.values()]
}
