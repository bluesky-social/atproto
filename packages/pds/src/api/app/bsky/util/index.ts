import { Kysely } from 'kysely'
import { DatabaseSchema } from '../../../../db/database-schema'
import * as util from '../../../../db/util'

type UserInfo = {
  did: string
  name: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: Kysely<DatabaseSchema>,
  user: string,
): Promise<UserInfo> => {
  const userInfo = await db
    .selectFrom('user_did')
    .where(util.userWhereClause(user))
    .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user_did.did')
    .select([
      'user_did.did as did',
      'user_did.username as name',
      'profile.displayName as displayName',
    ])
    .executeTakeFirst()
  if (!userInfo) {
    throw new Error(`Could not find entry for user: ${user}`)
  }
  return {
    did: userInfo.did,
    name: userInfo.name,
    displayName: userInfo.displayName || undefined,
  }
}

export const isEnum = <T extends { [s: string]: unknown }>(
  object: T,
  possibleValue: unknown,
): possibleValue is T[keyof T] => {
  return Object.values(object).includes(possibleValue)
}
