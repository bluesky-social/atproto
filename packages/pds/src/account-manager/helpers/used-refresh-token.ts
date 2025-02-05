import { RefreshToken } from '@atproto/oauth-provider'
import { AccountDb } from '../db'

/**
 * Note that the used refresh tokens will be removed once the token is revoked.
 * This is done through the foreign key constraint in the database.
 */
export const insertQB = (
  db: AccountDb,
  tokenId: number,
  refreshToken: RefreshToken,
) =>
  db.db
    .insertInto('used_refresh_token')
    .values({ tokenId, refreshToken })
    .onConflict((oc) => oc.doNothing())

export const findByTokenQB = (db: AccountDb, refreshToken: RefreshToken) =>
  db.db
    .selectFrom('used_refresh_token')
    // uses primary key index
    .where('refreshToken', '=', refreshToken)
    .select('tokenId')

export const countQB = (db: AccountDb, refreshToken: RefreshToken) =>
  db.db
    .selectFrom('used_refresh_token')
    // uses primary key index
    .where('refreshToken', '=', refreshToken)
    .select((qb) => qb.fn.count<number>('refreshToken').as('count'))
