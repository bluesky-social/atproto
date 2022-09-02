import { DataSource } from 'typeorm'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'

type UserInfo = {
  did: string
  name: string
  displayName: string | undefined
}

export const getUserInfo = async (
  db: DataSource,
  userNameOrDid: string,
): Promise<UserInfo> => {
  const builder = db
    .createQueryBuilder()
    .select([
      'user.did AS did',
      'user.username AS name',
      'profile.displayName AS displayName',
    ])
    .from(UserDid, 'user')
    .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')

  if (userNameOrDid.startsWith('did:')) {
    builder.where('user.did = :did', { did: userNameOrDid })
  } else {
    builder.where('user.username = :username', { username: userNameOrDid })
  }
  const userInfo = await builder.getRawOne()

  if (!userInfo) {
    throw new Error(`Could not find entry for user: ${userNameOrDid}`)
  }
  return {
    did: userInfo.did,
    name: userInfo.username,
    displayName: userInfo.displayName || undefined,
  }
}
