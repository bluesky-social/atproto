import { Server } from '../../../lexicon'
import * as GetLikedBy from '../../../lexicon/types/app/bsky/getLikedBy'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'

export default function (server: Server) {
  server.app.bsky.getLikedBy(
    async (params: GetLikedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before, cid } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('app_bsky_like as like')
        .where('like.subject', '=', uri)
        .innerJoin('user', 'like.creator', 'user.did')
        .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'like.createdAt as createdAt',
          'like.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('like.subjectCid', '=', cid)
      }

      builder = paginate(builder, {
        limit,
        before,
        by: ref('like.createdAt'),
      })

      const likedByRes = await builder.execute()

      const likedBy = likedByRes.map((row) => ({
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
          cursor: likedBy.at(-1)?.createdAt,
          likedBy,
        },
      }
    },
  )
}
