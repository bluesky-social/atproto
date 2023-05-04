import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

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
        .where('list.uri', '=', list)
        .selectAll()
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
        .where(notSoftDeletedClause(ref('subject_repo')))
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

      const itemProfiles = await services.appView
        .actor(db)
        .views.profile(itemsRes, requester)

      const items = itemsRes.map((item, i) => ({
        subject: itemProfiles[i],
        reason: item.reason ?? undefined,
        reasonFacets: item.reasonFacets
          ? JSON.parse(item.reasonFacets)
          : undefined,
      }))

      const subject = {
        name: listRes.name,
        description: listRes.description ?? undefined,
        descriptionFacets: listRes.descriptionFacets
          ? JSON.parse(listRes.descriptionFacets)
          : undefined,
        avatar: listRes.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', listRes.avatarCid)
          : undefined,
        indexedAt: listRes.indexedAt,
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
