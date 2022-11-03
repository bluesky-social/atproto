import { Server } from '../../../../lexicon'
import * as GetRepostedBy from '../../../../lexicon/types/app/bsky/feed/getRepostedBy'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.feed.getRepostedBy(
    async (params: GetRepostedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before, cid } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('app_bsky_repost as repost')
        .where('repost.subject', '=', uri)
        .innerJoin('user_did', 'user_did.did', 'repost.creator')
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'user_did.did',
        )
        .select([
          'user_did.did as did',
          'user_did.handle as handle',
          'profile.displayName as displayName',
          'repost.createdAt as createdAt',
          'repost.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      builder = paginate(builder, {
        limit,
        before,
        by: ref('repost.createdAt'),
      })

      const repostedByRes = await builder.execute()

      const repostedBy = repostedByRes.map((row) => ({
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
          repostedBy,
          cursor: repostedBy.at(-1)?.createdAt,
        },
      }
    },
  )
}
