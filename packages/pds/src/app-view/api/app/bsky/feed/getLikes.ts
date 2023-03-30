import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getLikes({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('like')
        .where('like.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'like.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'like.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .selectAll('creator')
        .select([
          'like.cid as cid',
          'like.createdAt as createdAt',
          'like.indexedAt as indexedAt',
        ])

      if (cid) {
        builder = builder.where('like.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('like.createdAt'), ref('like.cid'))
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const likesRes = await builder.execute()
      const actors = await services.appView
        .actor(db)
        .views.profile(likesRes, requester)

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
