import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { ProfileView } from '../../../../lexicon/types/app/bsky/actor/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getListMutes({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
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
      const profiles = await actorService.views.profile(listsRes, requester)
      const profilesMap = profiles.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.did]: cur,
        }),
        {} as Record<string, ProfileView>,
      )

      const lists = listsRes.map((row) =>
        graphService.formatListView(row, profilesMap),
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
