import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getEmbeddedBy({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('post')
        .innerJoin('post_embed_record', (join) => join
          .on('post.uri', '=', 'post_embed_record.postUri')
        )
        .where('post.uri', '=', uri)
        .innerJoin('actor as creator', 'creator.did', 'post.creator')
        .where(notSoftDeletedClause(ref('creator')))
        .selectAll('creator')
        .select(['post.cid as cid', 'post.sortAt as sortAt'])
        

      if (cid) {
        builder = builder.where('post_embed_record.embedCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('post.sortAt'), ref('post.cid'))
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const embeddedByRes = await builder.execute()
      const embeddedBy = await services
        .actor(db)
        .views.profile(embeddedByRes, requester)

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          embeddedBy,
          cursor: keyset.packFromResult(embeddedByRes),
        },
      }
    },
  })
}
