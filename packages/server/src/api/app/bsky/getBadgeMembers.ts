import { Server } from '../../../lexicon'
import * as GetBadgeMembers from '../../../lexicon/types/app/bsky/getBadgeMembers'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getBadgeMembers(
    async (params: GetBadgeMembers.QueryParams, _input, _req, res) => {
      const { uri, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('app_bsky_badge as badge')
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
        .innerJoin('user', 'user.did', 'accept.creator')
        .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
        .where('offer.creator', '=', 'badge.creator')
        .where('offer.subject', '=', 'accept.creator')
        .where('accept.offerUri', '=', 'offer.uri')
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'offer.indexedAt as offeredAt',
          'accept.indexedAt as acceptedAt',
        ])

      builder = paginate(builder, {
        limit,
        before,
        by: ref('accept.createdAt'),
      })

      const badgeMembersRes = await builder.execute()

      const members = badgeMembersRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        offeredAt: row.offeredAt,
        acceptedAt: row.acceptedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          members,
        },
      }
    },
  )
}
