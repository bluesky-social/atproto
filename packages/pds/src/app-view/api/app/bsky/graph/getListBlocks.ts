import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getListBlocks({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const { db } = ctx
      const { ref } = db.db.dynamic

      let listsReq = ctx.db.db
        .selectFrom('list')
        .whereExists(
          ctx.db.db
            .selectFrom('list_block')
            .where('list_block.creator', '=', requester)
            .whereRef('list_block.subjectUri', '=', ref('list.uri'))
            .selectAll(),
        )
        .selectAll()

      const keyset = new TimeCidKeyset(ref('list.createdAt'), ref('list.cid'))
      listsReq = paginate(listsReq, {
        limit,
        cursor,
        keyset,
      })
      const listsRes = await listsReq.execute()

      const lists = listsRes.map((row) => ({
        name: row.name,
        description: row.description ?? undefined,
        descriptionFacets: row.descriptionFacets
          ? JSON.parse(row.descriptionFacets)
          : undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        indexedAt: row.indexedAt,
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
