import { ProfileView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { FollowIndex } from '../records/follow'
import { PostIndex } from '../records/post'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'

const viewId = 'blueskyweb.xyz:ProfileView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is ProfileView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown): Promise<ProfileView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
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

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
