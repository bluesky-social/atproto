import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getLists({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.appView.actor(db)

      const creatorRes = await actorService.getActor(actor)
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let listsReq = ctx.db.db
        .selectFrom('list')
        .where('list.creator', '=', creatorRes.did)
        .selectAll('list')
        .select(
          ctx.db.db
            .selectFrom('list_block')
            .where('list_block.creator', '=', requester)
            .whereRef('list_block.subjectUri', '=', ref('list.uri'))
            .select('list_block.uri')
            .as('viewerBlocked'),
        )

      const keyset = new TimeCidKeyset(ref('list.indexedAt'), ref('list.cid'))
      listsReq = paginate(listsReq, {
        limit,
        cursor,
        keyset,
      })

      const [listsRes, creator] = await Promise.all([
        listsReq.execute(),
        actorService.views.profile(creatorRes, requester),
      ])

      const lists = listsRes.map((row) => ({
        uri: row.uri,
        creator: creator,
        name: row.name,
        purpose: row.purpose,
        description: row.description ?? undefined,
        descriptionFacets: row.descriptionFacets
          ? JSON.parse(row.descriptionFacets)
          : undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        indexedAt: row.indexedAt,
        viewer: {
          blocked: row.viewerBlocked ?? undefined,
        },
      }))

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
