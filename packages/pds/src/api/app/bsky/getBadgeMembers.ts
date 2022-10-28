import { Server } from '../../../lexicon'
import * as GetBadgeMembers from '../../../lexicon/types/app/bsky/getBadgeMembers'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getBadgeMembers(
    async (params: GetBadgeMembers.QueryParams, _input, _req, res) => {
      const { uri, cid, limit, before } = params
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
        .innerJoin('user_did', 'user_did.did', 'accept.creator')
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'user_did.did',
        )
        .where('badge.uri', '=', uri)
        .whereRef('offer.creator', '=', 'badge.creator')
        .whereRef('offer.subject', '=', 'accept.creator')
        .whereRef('accept.offerUri', '=', 'offer.uri')
        .select([
          'user_did.did as did',
          'user_did.username as name',
          'profile.displayName as displayName',
          'offer.createdAt as offeredAt',
          'accept.createdAt as acceptedAt',
        ])

      if (cid) {
        builder = builder
          .where('badge.cid', '=', 'cid')
          .where('offer.badgeCid', '=', cid)
          .where('accept.badgeCid', '=', cid)
      }

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
          cid,
          members,
          cursor: members.at(-1)?.acceptedAt,
        },
      }
    },
  )
}
