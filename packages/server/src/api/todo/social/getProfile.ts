import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import * as GetProfile from '../../../lexicon/types/todo/social/getProfile'
import { FollowIndex } from '../../../db/records/follow'
import { PostIndex } from '../../../db/records/post'
import { ProfileBadgeIndex, ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import * as util from '../../../db/util'
import { BadgeIndex } from '../../../db/records/badge'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.todo.social.getProfile(
    async (params: GetProfile.QueryParams, _input, req, res) => {
      const { user } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const queryRes = await db.db
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
        .from(User, 'user')
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

      if (!queryRes) {
        throw new InvalidRequestError(`Profile not found`)
      }

      const badgesRes = await db.db
        .createQueryBuilder()
        .select([
          'badge.uri AS uri',
          'badge.assertionType AS assertionType',
          'badge.assertionTag AS assertionTag',
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
        .leftJoin(User, 'issuer', 'issuer.did = badge.creator')
        .leftJoin(
          ProfileIndex,
          'issuer_profile',
          'issuer_profile.creator = issuer.did',
        )
        .where('profile.creator = :did', { did: queryRes.did })
        .getRawMany()

      const badges = badgesRes.map((row) => ({
        uri: row.uri,
        issuer: {
          did: row.issuerDid,
          name: row.issuerName,
          displayName: row.issuerDisplayName || undefined,
        },
        assertion: row.assertionType
          ? { type: row.assertionType, tag: row.assertionTag || undefined }
          : undefined,
        createdAt: row.createdAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          did: queryRes.did,
          name: queryRes.name,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          followsCount: queryRes.followsCount || 0,
          followersCount: queryRes.followersCount || 0,
          postsCount: queryRes.postsCount || 0,
          badges: badges,
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}
