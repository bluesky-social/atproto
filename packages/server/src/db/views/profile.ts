import { ProfileView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { FollowIndex } from '../records/follow'
import { PostIndex } from '../records/post'
import { ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'
import * as util from '../util'

const viewId = 'blueskyweb.xyz:ProfileView'
const validator = schemas.createViewValidator(viewId)
const validParams = (obj: unknown): obj is ProfileView.Params => {
  return validator.isParamsValid(obj)
}

export const viewFn =
  (db: DataSource) =>
  async (params: unknown, requester: string): Promise<ProfileView.Response> => {
    if (!validParams(params)) {
      throw new Error(`Invalid params for ${viewId}`)
    }
    const { user } = params

    const res = await db
      .createQueryBuilder()
      .select([
        'user.did AS did',
        'user.username AS name',
        'profile.displayName AS displayName',
        'profile.description AS description',
        'follows_count.count AS followsCount',
        'followers_count.count AS followersCount',
        'posts_count.count AS postsCount',
        'profile.badges AS badgeRefs',
        'requester_follows.doesExist AS requesterHasFollowed',
      ])
      .from(UserDid, 'user')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .leftJoin(
        util.countSubquery(FollowIndex, 'subject'),
        'follows_count',
        'follows_count.subject = user.did',
      )
      .leftJoin(
        util.countSubquery(FollowIndex, 'creator'),
        'followers_count',
        'followers_count.subject = user.did',
      )
      .leftJoin(
        util.countSubquery(PostIndex, 'creator'),
        'posts_count',
        'posts_count.subject = user.did',
      )
      .leftJoin(
        util.existsByCreatorSubquery(FollowIndex, 'subject', requester),
        'requester_follows',
        'requester_follows.subject = user.did',
      )
      .where(util.userWhereClause(user), { user })
      .getRawOne()

    // @TODO add `myState.hasFollowed` & resolve badge refs

    return {
      did: res.did,
      name: res.name,
      displayName: res.displayName || undefined,
      description: res.description || undefined,
      followsCount: res.followsCount || 0,
      followersCount: res.followersCount || 0,
      postsCount: res.postsCount || 0,
      badges: [], // @TODO add in badges
      myState: {
        hasFollowed: Boolean(res.requesterHasFollowed),
      },
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
