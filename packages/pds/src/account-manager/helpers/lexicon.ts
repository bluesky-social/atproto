import { Insertable } from 'kysely'
import { LexiconData } from '@atproto/oauth-provider'
import { fromDateISO, fromJson, toDateISO, toJson } from '../../db'
import { AccountDb, Lexicon } from '../db'

export async function upsert(db: AccountDb, nsid: string, data: LexiconData) {
  const updates: Omit<Insertable<Lexicon>, 'nsid'> = {
    ...data,
    createdAt: toDateISO(data.createdAt),
    updatedAt: toDateISO(data.updatedAt),
    lastSucceededAt: data.lastSucceededAt
      ? toDateISO(data.lastSucceededAt)
      : null,
    lexicon: data.lexicon ? toJson(data.lexicon) : null,
  }

  await db.executeWithRetry(
    db.db
      .insertInto('lexicon')
      .values({ ...updates, nsid })
      .onConflict((oc) => oc.column('nsid').doUpdateSet(updates)),
  )
}

export async function find(
  db: AccountDb,
  nsid: string,
): Promise<LexiconData | null> {
  const row = await db.db
    .selectFrom('lexicon')
    .selectAll()
    .where('nsid', '=', nsid)
    .executeTakeFirst()
  if (!row) return null

  return {
    ...row,
    createdAt: fromDateISO(row.createdAt),
    updatedAt: fromDateISO(row.updatedAt),
    lastSucceededAt: row.lastSucceededAt
      ? fromDateISO(row.lastSucceededAt)
      : null,
    lexicon: row.lexicon ? fromJson(row.lexicon) : null,
  }
}

export async function remove(db: AccountDb, nsid: string) {
  await db.db.deleteFrom('lexicon').where('nsid', '=', nsid).execute()
}
