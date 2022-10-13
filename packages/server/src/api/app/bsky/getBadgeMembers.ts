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
        .selectFrom('app_bsky_accepted_badge as accepted')
        .where('accepted.subject', '=', 'uri')
        .innerJoin('user', 'accepted.creator', 'user.did')
        .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'accepted.createdAt as createdAt',
          'accepted.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('accepted.subjectCid', '=', cid)
      }

      builder = paginate(builder, {
        limit,
        before,
        by: ref('accepted.createdAt'),
      })

      const badgeMembersRes = await builder.execute()

      const members = badgeMembersRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          members,
        },
      }
    },
  )
}
