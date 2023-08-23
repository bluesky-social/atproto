import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { uri, limit, cursor, cid } = params
      const requester = auth.credentials.did
      const db = ctx.db.getReplica()
      const graphService = ctx.services.graph(db)
      const { ref } = db.db.dynamic

      let builder = db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('actor as creator', 'creator.did', 'repost.creator')
        .where(notSoftDeletedClause(ref('creator')))
        .whereNotExists(
          graphService.blockQb(requester, [ref('repost.creator')]),
        )
        .selectAll('creator')
        .select(['repost.cid as cid', 'repost.sortAt as sortAt'])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(ref('repost.sortAt'), ref('repost.cid'))
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const repostedByRes = await builder.execute()
      const repostedBy = await ctx.services
        .actor(db)
        .views.hydrateProfiles(repostedByRes, requester)

      return {
        encoding: 'application/json',
        body: {
          uri,
          cid,
          repostedBy,
          cursor: keyset.packFromResult(repostedByRes),
        },
      }
    },
  })
}
