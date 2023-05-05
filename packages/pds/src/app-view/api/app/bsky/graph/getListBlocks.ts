import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { ProfileView } from '../../../../../lexicon/types/app/bsky/actor/defs'

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
        .innerJoin('did_handle', 'did_handle.did', 'list.creator')
        .whereExists(
          ctx.db.db
            .selectFrom('list_block')
            .where('list_block.creator', '=', requester)
            .whereRef('list_block.subjectUri', '=', ref('list.uri'))
            .selectAll(),
        )
        .selectAll('list')
        .selectAll('did_handle')
        .select(
          ctx.db.db
            .selectFrom('list_block')
            .where('list_block.creator', '=', requester)
            .whereRef('list_block.subjectUri', '=', ref('list.uri'))
            .select('list_block.uri')
            .as('viewerBlocked'),
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

      const lists = listsRes.map((row) => ({
        uri: row.uri,
        creator: profilesMap[row.creator],
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
