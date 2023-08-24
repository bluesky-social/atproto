import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getLikes({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did

      const db = ctx.db.getReplica()
      const graphService = ctx.services.graph(db)

      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('like')
        .where('like.subject', '=', uri)
        .innerJoin('actor as creator', 'creator.did', 'like.creator')
        .where(notSoftDeletedClause(ref('creator')))
        .whereNotExists(graphService.blockQb(requester, [ref('like.creator')]))
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
      const actors = await ctx.services
        .actor(db)
        .views.profiles(likesRes, requester)

      const likes = mapDefined(likesRes, (row) =>
        actors[row.did]
          ? {
              createdAt: row.createdAt,
              indexedAt: row.indexedAt,
              actor: actors[row.did],
            }
          : undefined,
      )

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          cursor: keyset.packFromResult(likesRes),
          likes,
        },
      }
    },
  })
}
