import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { ProfileView } from '../../../../lexicon/types/app/bsky/actor/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getList({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { list, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const graphService = ctx.services.graph(ctx.db)

      const listRes = await graphService
        .getListsQb(requester)
        .where('list.uri', '=', list)
        .executeTakeFirst()
      if (!listRes) {
        throw new InvalidRequestError(`List not found: ${list}`)
      }

      let itemsReq = graphService
        .getListItemsQb()
        .where('list_item.listUri', '=', list)
        .where('list_item.creator', '=', listRes.creator)

      const keyset = new TimeCidKeyset(
        ref('list_item.sortAt'),
        ref('list_item.cid'),
      )
      itemsReq = paginate(itemsReq, {
        limit,
        cursor,
        keyset,
      })
      const itemsRes = await itemsReq.execute()

      const actorService = services.actor(db)
      const profiles = await actorService.views.profile(itemsRes, requester)
      const profilesMap = profiles.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.did]: cur,
        }),
        {} as Record<string, ProfileView>,
      )

      const items = itemsRes.map((item) => ({
        subject: profilesMap[item.did],
      }))

      const creator = await actorService.views.profile(listRes, requester)

      const subject = {
        uri: listRes.uri,
        creator,
        name: listRes.name,
        purpose: listRes.purpose,
        description: listRes.description ?? undefined,
        descriptionFacets: listRes.descriptionFacets
          ? JSON.parse(listRes.descriptionFacets)
          : undefined,
        avatar: listRes.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri(
              'avatar',
              listRes.creator,
              listRes.avatarCid,
            )
          : undefined,
        indexedAt: listRes.indexedAt,
        viewer: {
          muted: !!listRes.viewerMuted,
        },
      }

      return {
        encoding: 'application/json',
        body: {
          items,
          list: subject,
          cursor: keyset.packFromResult(itemsRes),
        },
      }
    },
  })
}
