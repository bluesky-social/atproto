import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getListMutes({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (await ctx.canProxyRead(req, requester)) {
        const res = await ctx.appviewAgent.api.app.bsky.graph.getListMutes(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { limit, cursor } = params
      const { db } = ctx
      const { ref } = db.db.dynamic

      const graphService = ctx.services.appView.graph(ctx.db)

      let listsReq = graphService
        .getListsQb(requester)
        .whereExists(
          ctx.db.db
            .selectFrom('list_mute')
            .where('list_mute.mutedByDid', '=', requester)
            .whereRef('list_mute.listUri', '=', ref('list.uri'))
            .selectAll(),
        )

      const keyset = new TimeCidKeyset(ref('list.createdAt'), ref('list.cid'))
      listsReq = paginate(listsReq, {
        limit,
        cursor,
        keyset,
      })
      const listsRes = await listsReq.execute()

      const actorService = ctx.services.appView.actor(ctx.db)
      const profiles = await actorService.views.profiles(listsRes, requester)

      const lists = listsRes.map((row) =>
        graphService.formatListView(row, profiles),
      )

      return {
        encoding: 'application/json',
        body: {
          lists,
          cursor: keyset.packFromResult(listsRes),
        },
      }
    },
  })
}
