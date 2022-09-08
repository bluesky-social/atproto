import { DataSource } from 'typeorm'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import * as util from '../util'

type UserInfo = {
  did: string
  name: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: DataSource,
  user: string,
): Promise<UserInfo> => {
  const userInfo = await db
    .createQueryBuilder()
    .select([
      'user.did AS did',
      'user.username AS name',
      'profile.displayName AS displayName',
    ])
    .from(UserDid, 'user')
    .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
    .where(util.userWhereClause(user), { user })
    .getRawOne()
  if (!userInfo) {
    throw new Error(`Could not find entry for user: ${user}`)
  }
  return {
    did: userInfo.did,
    name: userInfo.name,
    displayName: userInfo.displayName || undefined,
  }
}
