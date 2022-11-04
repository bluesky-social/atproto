import { Kysely } from 'kysely'
import { DatabaseSchema } from '../../../../db/database-schema'
import * as util from '../../../../db/util'

type UserInfo = {
  did: string
  handle: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: Kysely<DatabaseSchema>,
  user: string,
): Promise<UserInfo> => {
  const userInfo = await db
    .selectFrom('did_handle')
    .where(util.actorWhereClause(user))
    .leftJoin(
      'app_bsky_profile as profile',
      'profile.creator',
      'did_handle.did',
    )
    .select([
      'did_handle.did as did',
      'did_handle.handle as handle',
      'profile.displayName as displayName',
    ])
    .executeTakeFirst()
  if (!userInfo) {
    throw new Error(`Could not find entry for user: ${user}`)
  }
  return {
    did: userInfo.did,
    handle: userInfo.handle,
    displayName: userInfo.displayName || undefined,
  }
}

export const isEnum = <T extends { [s: string]: unknown }>(
  object: T,
  possibleValue: unknown,
): possibleValue is T[keyof T] => {
  return Object.values(object).includes(possibleValue)
}
