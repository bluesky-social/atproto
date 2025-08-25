import { Insertable } from 'kysely'
import { LexiconData } from '@atproto/oauth-provider'
import { fromDateISO, fromJson, toDateISO, toJson } from '../../db'
import { assertEmpty } from '../../util/types'
import { AccountDb, Lexicon } from '../db'

export async function upsert(
  db: AccountDb,
  nsid: string,
  { createdAt, updatedAt, lastSucceededAt, uri, lexicon, ...rest }: LexiconData,
) {
  assertEmpty(rest, 'Unexpected lexicon data')

  const updates: Omit<Insertable<Lexicon>, 'nsid'> = {
    createdAt: toDateISO(createdAt),
    updatedAt: toDateISO(updatedAt),
    lastSucceededAt: toDateISO(lastSucceededAt),
    uri,
    lexicon: toJson(lexicon),
  }

  await db.db
    .insertInto('lexicon')
    .values({ nsid, ...updates })
    .onConflict((oc) => oc.column('nsid').doUpdateSet(updates))
    .execute()
}

export async function find(
  db: AccountDb,
  nsid: string,
): Promise<LexiconData | null> {
  const result = await db.db
    .selectFrom('lexicon')
    .selectAll()
    .where('nsid', '=', nsid)
    .executeTakeFirst()
  if (!result) return null

  return {
    createdAt: fromDateISO(result.createdAt),
    updatedAt: fromDateISO(result.updatedAt),
    lastSucceededAt: fromDateISO(result.lastSucceededAt),
    uri: result.uri,
    lexicon: fromJson(result.lexicon),
  }
}

export async function remove(db: AccountDb, nsid: string) {
  await db.db.deleteFrom('lexicon').where('nsid', '=', nsid).execute()
}
