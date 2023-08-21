import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getRepostedBy({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (await ctx.canProxyRead(req, requester)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getRepostedBy(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { uri, limit, cursor, cid } = params
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const graphService = ctx.services.appView.graph(ctx.db)

      let builder = db.db
        .selectFrom('repost')
        .where('repost.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'repost.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'repost.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .whereNotExists(
          graphService.blockQb(requester, [ref('repost.creator')]),
        )
        .selectAll('creator')
        .select(['repost.cid as cid', 'repost.createdAt as createdAt'])

      if (cid) {
        builder = builder.where('repost.subjectCid', '=', cid)
      }

      const keyset = new TimeCidKeyset(
        ref('repost.createdAt'),
        ref('repost.cid'),
      )
      builder = paginate(builder, {
        limit,
        cursor,
        keyset,
      })

      const repostedByRes = await builder.execute()
      const repostedBy = await services.appView
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
