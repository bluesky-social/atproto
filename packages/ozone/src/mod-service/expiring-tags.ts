import { Selectable } from 'kysely'
import { Database } from '../db'
import { ExpiringTag } from '../db/schema/expiring_tag'

export type ExpiringTagRow = Selectable<ExpiringTag>

export type ExpiringTagGroup = {
  did: string
  recordPath: string
  createdBy: string
  tags: string[]
  ids: number[]
}

export async function insertExpiringTags(
  db: Database,
  params: {
    eventId: number
    did: string
    recordPath: string
    tags: string[]
    expiresAt: string
    createdBy: string
  },
): Promise<void> {
  await db.db
    .insertInto('expiring_tag')
    .values(
      params.tags.map((tag) => ({
        eventId: params.eventId,
        did: params.did,
        recordPath: params.recordPath,
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
    did: string
    recordPath: string
    tags: string[]
  },
): Promise<void> {
  await db.db
    .deleteFrom('expiring_tag')
    .where('did', '=', params.did)
    .where('recordPath', '=', params.recordPath)
    .where('tag', 'in', params.tags)
    .execute()
}

export async function deleteExpiringTagsByIds(
  db: Database,
  ids: number[],
): Promise<void> {
  await db.db.deleteFrom('expiring_tag').where('id', 'in', ids).execute()
}

export async function getExpiredTags(
  db: Database,
): Promise<ExpiringTagGroup[]> {
  const now = new Date().toISOString()
  const rows = await db.db
    .selectFrom('expiring_tag')
    .where('expiresAt', '<', now)
    .selectAll()
    .execute()

  if (!rows.length) return []

  // Group by (did, recordPath, createdBy) so each reversal event has the correct author
  const grouped = new Map<string, ExpiringTagGroup>()
  for (const row of rows) {
    const key = `${row.did}|${row.recordPath}|${row.createdBy}`
    let group = grouped.get(key)
    if (!group) {
      group = {
        did: row.did,
        recordPath: row.recordPath,
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
