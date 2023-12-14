import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getBlocks({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      let blocksReq = db.db
        .selectFrom('actor_block')
        .where('actor_block.creator', '=', requester)
        .innerJoin('actor as subject', 'subject.did', 'actor_block.subjectDid')
        .where(notSoftDeletedClause(ref('subject')))
        .selectAll('subject')
        .select(['actor_block.cid as cid', 'actor_block.sortAt as sortAt'])

      const keyset = new TimeCidKeyset(
        ref('actor_block.sortAt'),
        ref('actor_block.cid'),
      )
      blocksReq = paginate(blocksReq, {
        limit,
        cursor,
        keyset,
      })

      const blocksRes = await blocksReq.execute()

      const actorService = ctx.services.actor(db)
      const blocks = await actorService.views.profilesList(blocksRes, requester)

      return {
        encoding: 'application/json',
        body: {
          blocks,
          cursor: keyset.packFromResult(blocksRes),
        },
      }
    },
  })
}
