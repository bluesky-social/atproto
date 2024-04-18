import { RefreshToken } from '@atproto-labs/oauth-provider'
import { AccountDb } from '../db'

export const insert = async (
  db: AccountDb,
  id: number,
  usedRefreshToken: RefreshToken,
) => {
  await db.executeWithRetry(
    db.db
      .insertInto('used_refresh_token')
      .values({ id, usedRefreshToken })
      .onConflict((oc) => oc.doNothing()),
  )
}

export const findByToken = (db: AccountDb, usedRefreshToken: RefreshToken) => {
  return db.db
    .selectFrom('used_refresh_token')
    .where('usedRefreshToken', '=', usedRefreshToken)
    .select('id')
    .executeTakeFirst()
    .then((row) => row?.id ?? null)
}
