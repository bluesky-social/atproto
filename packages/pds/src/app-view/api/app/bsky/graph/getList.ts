import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { ProfileView } from '../../../../../lexicon/types/app/bsky/actor/defs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getList({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { list, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const listRes = await ctx.db.db
        .selectFrom('list')
        .innerJoin('did_handle', 'did_handle.did', 'list.creator')
        .where('list.uri', '=', list)
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
        .executeTakeFirst()

      if (!listRes) {
        throw new InvalidRequestError(`List not found: ${list}`)
      }

      let itemsReq = ctx.db.db
        .selectFrom('list_item')
        .where('list_item.listUri', '=', list)
        .where('list_item.creator', '=', listRes.creator)
        .innerJoin(
          'did_handle as subject',
          'subject.did',
          'list_item.subjectDid',
        )
        .selectAll('subject')
        .select([
          'list_item.cid as cid',
          'list_item.createdAt as createdAt',
          'list_item.reason as reason',
          'list_item.reasonFacets as reasonFacets',
        ])

      const keyset = new TimeCidKeyset(
        ref('list_item.createdAt'),
        ref('list_item.cid'),
      )
      itemsReq = paginate(itemsReq, {
        limit,
        cursor,
        keyset,
      })
      const itemsRes = await itemsReq.execute()

      const actorService = services.appView.actor(db)
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
        reason: item.reason ?? undefined,
        reasonFacets: item.reasonFacets
          ? JSON.parse(item.reasonFacets)
          : undefined,
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
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', listRes.avatarCid)
          : undefined,
        indexedAt: listRes.indexedAt,
        viewer: {
          blocked: listRes.viewerBlocked ?? undefined,
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
