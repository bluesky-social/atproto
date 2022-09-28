import { DataSource } from 'typeorm'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import * as util from '../../../db/util'

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
    .from(User, 'user')
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
