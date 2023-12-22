import { mapDefined } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.iss
      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)

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

      const [listsRes, profiles] = await Promise.all([
        listsReq.execute(),
        actorService.views.profiles([creatorRes], requester),
      ])
      if (!profiles[creatorRes.did]) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      const lists = mapDefined(listsRes, (row) =>
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
