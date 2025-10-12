import { MINUTE, lessThanAgoMs } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getRandomToken } from '../../api/com/atproto/server/util'
import { AccountDb, EmailTokenPurpose } from '../db'

export const createEmailToken = async (
  db: AccountDb,
  did: string,
  purpose: EmailTokenPurpose,
): Promise<string> => {
  const token = getRandomToken().toUpperCase()
  const now = new Date().toISOString()
  await db.executeWithRetry(
    db.db
      .insertInto('email_token')
      .values({ purpose, did, token, requestedAt: now })
      .onConflict((oc) =>
        oc.columns(['purpose', 'did']).doUpdateSet({ token, requestedAt: now }),
      ),
  )
  return token
}

export const deleteEmailToken = async (
  db: AccountDb,
  did: string,
  purpose: EmailTokenPurpose,
) => {
  await db.executeWithRetry(
    db.db
      .deleteFrom('email_token')
      .where('did', '=', did)
      .where('purpose', '=', purpose),
  )
}

export const deleteAllEmailTokens = async (db: AccountDb, did: string) => {
  await db.executeWithRetry(
    db.db.deleteFrom('email_token').where('did', '=', did),
  )
}

export const assertValidToken = async (
  db: AccountDb,
  did: string,
  purpose: EmailTokenPurpose,
  token: string,
  expirationLen = 15 * MINUTE,
) => {
  const res = await db.db
    .selectFrom('email_token')
    .selectAll()
    .where('purpose', '=', purpose)
    .where('did', '=', did)
    .where('token', '=', token.toUpperCase())
    .executeTakeFirst()
  if (!res) {
    throw new InvalidRequestError('Token is invalid', 'InvalidToken')
  }
  const expired = !lessThanAgoMs(new Date(res.requestedAt), expirationLen)
  if (expired) {
    throw new InvalidRequestError('Token is expired', 'ExpiredToken')
  }
}

export const assertValidTokenAndFindDid = async (
  db: AccountDb,
  purpose: EmailTokenPurpose,
  token: string,
  expirationLen = 15 * MINUTE,
): Promise<string> => {
  const res = await db.db
    .selectFrom('email_token')
    .select(['did', 'requestedAt'])
    .where('purpose', '=', purpose)
    .where('token', '=', token.toUpperCase())
    .executeTakeFirst()
  if (!res) {
    throw new InvalidRequestError('Token is invalid', 'InvalidToken')
  }
  const expired = !lessThanAgoMs(new Date(res.requestedAt), expirationLen)
  if (expired) {
    throw new InvalidRequestError('Token is expired', 'ExpiredToken')
  }
  return res.did
}
