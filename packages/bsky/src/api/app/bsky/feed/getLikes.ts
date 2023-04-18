import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getLikes({
    auth: authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('like')
        .where('like.subject', '=', uri)
        .innerJoin('actor as creator', 'creator.did', 'like.creator')
        .where(notSoftDeletedClause(ref('creator')))
        .selectAll('creator')
        .select([
          'like.cid as cid',
          'like.createdAt as createdAt',
          'like.indexedAt as indexedAt',
          'like.sortAt as sortAt',
        ])

      if (cid) {
        builder = builder.where('like.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('like.sortAt'), ref('like.cid'))
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const likesRes = await builder.execute()
      const actors = await services.actor(db).views.profile(likesRes, requester)

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          cursor: keyset.packFromResult(likesRes),
          likes: likesRes.map((row, i) => ({
            createdAt: row.createdAt,
            indexedAt: row.indexedAt,
            actor: actors[i],
          })),
        },
      }
    },
  })
}
