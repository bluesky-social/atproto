import { mapDefined } from '@atproto/common'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getLikes({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (await ctx.canProxyRead(req, requester)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getLikes(
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
        .selectFrom('like')
        .where('like.subject', '=', uri)
        .innerJoin('did_handle as creator', 'creator.did', 'like.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'like.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .whereNotExists(graphService.blockQb(requester, [ref('like.creator')]))
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
