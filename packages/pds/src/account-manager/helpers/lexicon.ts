import { LEXICON_REFRESH_FREQUENCY, LexiconData } from '@atproto/oauth-provider'
import { fromDateISO, fromJson, toDateISO, toJson } from '../../db/index.js'
import { AccountDb } from '../db/index.js'

export async function upsert(db: AccountDb, nsid: string, data: LexiconData) {
  // @TODO not annotated as `Omit<Insertable<Lexicon>, 'nsid'>`. Insertable's
  // nullable/non-nullable key partition evaluates `IsNullable<InsertType<…>>`
  // per column, which for the recursive `JsonEncoded<LexiconDocument>` column
  // overflows the tsgo (TS7) checker's instantiation depth (TS2589). The older
  // tsc handled it; the `.values()`/`.doUpdateSet()` calls below still
  // type-check this object against the insert type regardless.
  const updates = {
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

  // Garbage collection: remove old, never resolved, lexicons.
  // Uses "lexicon_failures_idx"
  await db.executeWithRetry(
    db.db
      .deleteFrom('lexicon')
      .where('lexicon', 'is', null)
      .where(
        'updatedAt',
        '<',
        toDateISO(new Date(Date.now() - LEXICON_REFRESH_FREQUENCY)),
      ),
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
