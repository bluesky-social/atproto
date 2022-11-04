import { Server } from '../../../../lexicon'
import * as GetLikedBy from '../../../../lexicon/types/app/bsky/feed/getLikedBy'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.feed.getLikedBy(
    async (params: GetLikedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before, cid } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('app_bsky_like as like')
        .where('like.subject', '=', uri)
        .innerJoin('did_handle', 'like.creator', 'did_handle.did')
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'did_handle.did',
        )
        .select([
          'did_handle.did as did',
          'did_handle.handle as handle',
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
        handle: row.handle,
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
