import { RefreshToken } from '@atproto/oauth-provider'
import { AccountDb } from '../db'

/**
 * Note that the used refresh tokens will be removed once the token is revoked.
 * This is done through the foreign key constraint in the database.
 */
export const insert = async (
  db: AccountDb,
  tokenId: number,
  refreshToken: RefreshToken,
) => {
  await db.db
    .insertInto('used_refresh_token')
    .values({ tokenId, refreshToken })
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export const findByToken = async (
  db: AccountDb,
  refreshToken: RefreshToken,
) => {
  const row = await db.db
    .selectFrom('used_refresh_token')
    .where('refreshToken', '=', refreshToken)
    .select('tokenId')
    .executeTakeFirst()
  return row?.tokenId ?? null
}

export const hasRefreshToken = async (
  db: AccountDb,
  refreshToken: RefreshToken,
) => {
  const row = await db.db
    .selectFrom('used_refresh_token')
    .where('refreshToken', '=', refreshToken)
    .select((qb) => qb.fn.count<number>('refreshToken').as('count'))
    .executeTakeFirst()
  return row ? row.count > 0 : false
}
