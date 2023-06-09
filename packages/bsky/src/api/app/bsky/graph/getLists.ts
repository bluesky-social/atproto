import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getLists({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.actor(db)
      const graphService = services.graph(db)

      const creatorRes = await actorService.getActor(actor)
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let listsReq = graphService
        .getListsQb(requester)
        .where('list.creator', '=', creatorRes.did)

      const keyset = new TimeCidKeyset(ref('list.sortAt'), ref('list.cid'))
      listsReq = paginate(listsReq, {
        limit,
        cursor,
        keyset,
      })

      const [listsRes, creator] = await Promise.all([
        listsReq.execute(),
        actorService.views.profile(creatorRes, requester),
      ])
      const profileMap = {
        [creator.did]: creator,
      }

      const lists = listsRes.map((row) =>
        graphService.formatListView(row, profileMap),
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
