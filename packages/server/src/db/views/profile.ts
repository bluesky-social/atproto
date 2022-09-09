import { ProfileView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { FollowIndex } from '../records/follow'
import { PostIndex } from '../records/post'
import { ProfileBadgeIndex, ProfileIndex } from '../records/profile'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { DbViewPlugin } from '../types'
import * as util from '../util'
import { BadgeIndex } from '../records/badge'

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
        'requester_follow.uri AS requesterFollow',
      ])
      .from(UserDid, 'user')
      .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
      .leftJoin(
        util.countSubquery(FollowIndex, 'creator'),
        'follows_count',
        'follows_count.subject = user.did',
      )
      .leftJoin(
        util.countSubquery(FollowIndex, 'subject'),
        'followers_count',
        'followers_count.subject = user.did',
      )
      .leftJoin(
        util.countSubquery(PostIndex, 'creator'),
        'posts_count',
        'posts_count.subject = user.did',
      )
      .leftJoin(
        FollowIndex,
        'requester_follow',
        `requester_follow.creator = :requester AND requester_follow.subject = user.did`,
        { requester },
      )
      .where(util.userWhereClause(user), { user })
      .getRawOne()

    const badgesRes = await db
      .createQueryBuilder()
      .select([
        'badge.uri AS uri',
        'badge.assertionType AS assertionType',
        'issuer.did AS issuerDid',
        'issuer.username AS issuerName',
        'issuer_profile.displayName AS issuerDisplayName',
        'badge.createdAt AS createdAt',
      ])
      .from(ProfileIndex, 'profile')
      .innerJoin(
        ProfileBadgeIndex,
        'profile_badge',
        'profile_badge.profile = profile.uri',
      )
      .innerJoin(BadgeIndex, 'badge', 'badge.uri = profile_badge.badge')
      .leftJoin(UserDid, 'issuer', 'issuer.did = badge.creator')
      .leftJoin(
        ProfileIndex,
        'issuer_profile',
        'issuer_profile.creator = issuer.did',
      )
      .where('profile.creator = :did', { did: res.did })
      .getRawMany()

    const badges = badgesRes.map((row) => ({
      uri: row.uri,
      issuer: {
        did: row.issuerDid,
        name: row.issuerName,
        displayName: row.issuerDisplayName || undefined,
      },
      assertion: row.assertionType ? { type: row.assertionType } : undefined,
      createdAt: row.createdAt,
    }))

    return {
      did: res.did,
      name: res.name,
      displayName: res.displayName || undefined,
      description: res.description || undefined,
      followsCount: res.followsCount || 0,
      followersCount: res.followersCount || 0,
      postsCount: res.postsCount || 0,
      badges: badges,
      myState: {
        follow: res.requesterFollow || undefined,
      },
    }
  }

const plugin: DbViewPlugin = {
  id: viewId,
  fn: viewFn,
}

export default plugin
