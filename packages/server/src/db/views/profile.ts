import {
  isLikedByParams,
  isProfileParams,
  LikedByView,
  ProfileView,
} from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { AdxRecord } from '../record'
import { FollowIndex } from '../records/follow'
import { LikeIndex } from '../records/like'
import { PostIndex } from '../records/post'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'

export const profile =
  (db: DataSource) =>
  async (params: unknown): Promise<ProfileView.Response> => {
    if (!isProfileParams(params)) {
      throw new Error('Invalid params for blueskyweb.xyz:ProfileView')
    }
    const { user } = params

    const baseProfile = await db
      .createQueryBuilder()
      .select([
        'user.did AS did',
        'user.username AS name',
        'profile.displayName AS displayName',
        'profile.description AS description',
        'profile.badges AS badgeRefs',
      ])
      .from(UserDid, 'user')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .where('user.username = :user', { user })
      .getRawOne()

    if (!baseProfile) {
      throw new Error('Could not find user profile')
    }

    const followersCount = await db
      .getRepository(FollowIndex)
      .countBy({ subject: baseProfile.did })

    const followsCount = await db
      .getRepository(FollowIndex)
      .countBy({ creator: baseProfile.did })

    const postsCount = await db
      .getRepository(PostIndex)
      .countBy({ creator: baseProfile.did })

    // @TODO add `myState.hasFollowed` & resolve badge refs

    return {
      did: baseProfile.did,
      name: baseProfile.name,
      displayName: baseProfile.displayName,
      description: baseProfile.description,
      followersCount,
      followsCount,
      postsCount,
      badges: [],
    }
  }

export default profile
