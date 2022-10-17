import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import * as GetProfile from '../../../lexicon/types/app/bsky/getProfile'
import { countAll, userWhereClause } from '../../../db/util'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.app.bsky.getProfile(
    async (params: GetProfile.QueryParams, _input, req, res) => {
      const { user } = params
      const { auth, db } = locals.get(res)

      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const { ref } = db.db.dynamic

      const queryRes = await db.db
        .selectFrom('user')
        .where(userWhereClause(user))
        .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
        .select([
          'user.did as did',
          'user.username as name',
          'profile.uri as profileUri',
          'profile.displayName as displayName',
          'profile.description as description',
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('creator', '=', ref('user.did'))
            .select(countAll.as('count'))
            .as('followsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .whereRef('subject', '=', ref('user.did'))
            .select(countAll.as('count'))
            .as('followersCount'),
          db.db
            .selectFrom('app_bsky_post')
            .whereRef('creator', '=', ref('user.did'))
            .select(countAll.as('count'))
            .as('postsCount'),
          db.db
            .selectFrom('app_bsky_follow')
            .where('creator', '=', requester)
            .whereRef('subject', '=', ref('user.did'))
            .select('uri')
            .as('requesterFollow'),
        ])
        .executeTakeFirst()

      if (!queryRes) {
        throw new InvalidRequestError(`Profile not found`)
      }

      const badgesRes = await db.db
        .selectFrom('app_bsky_profile_badge as profile_badge')
        .where('profile_badge.profileUri', '=', queryRes.profileUri || '')
        .innerJoin(
          'app_bsky_badge as badge',
          'badge.uri',
          'profile_badge.badgeUri',
        )
        .innerJoin(
          'app_bsky_badge_offer as offer',
          'offer.badgeUri',
          'badge.uri',
        )
        .innerJoin(
          'app_bsky_badge_accept as accept',
          'accept.badgeUri',
          'badge.uri',
        )
        .innerJoin('user as issuer', 'issuer.did', 'badge.creator')
        .where('offer.subject', '=', queryRes.did)
        .whereRef('offer.creator', '=', 'badge.creator')
        .whereRef('accept.offerUri', '=', 'offer.uri')
        .leftJoin(
          'app_bsky_profile as issuer_profile',
          'issuer_profile.creator',
          'issuer.did',
        )
        .select([
          'badge.uri as uri',
          'badge.cid as cid',
          'issuer.did as issuerDid',
          'issuer.username as issuerName',
          'issuer_profile.displayName as issuerDisplayName',
          'badge.assertionType as assertionType',
          'badge.assertionTag as assertionTag',
          'badge.createdAt as createdAt',
        ])
        .execute()

      const badges = badgesRes.map((row) => ({
        uri: row.uri,
        cid: row.cid,
        issuer: {
          did: row.issuerDid,
          name: row.issuerName,
          displayName: row.issuerDisplayName || undefined,
        },
        assertion: {
          type: row.assertionType,
          tag: row.assertionTag || undefined,
        },
        createdAt: row.createdAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          did: queryRes.did,
          name: queryRes.name,
          displayName: queryRes.displayName || undefined,
          description: queryRes.description || undefined,
          followsCount: queryRes.followsCount,
          followersCount: queryRes.followersCount,
          postsCount: queryRes.postsCount,
          pinnedBadges: badges,
          myState: {
            follow: queryRes.requesterFollow || undefined,
          },
        },
      }
    },
  )
}
