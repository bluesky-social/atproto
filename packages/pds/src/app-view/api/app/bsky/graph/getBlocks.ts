import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getBlocks({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.graph.getBlocks(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { limit, cursor } = params
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      let blocksReq = ctx.db.db
        .selectFrom('actor_block')
        .where('actor_block.creator', '=', requester)
        .innerJoin(
          'did_handle as subject',
          'subject.did',
          'actor_block.subjectDid',
        )
        .innerJoin(
          'repo_root as subject_repo',
          'subject_repo.did',
          'actor_block.subjectDid',
        )
        .where(notSoftDeletedClause(ref('subject_repo')))
        .selectAll('subject')
        .select([
          'actor_block.cid as cid',
          'actor_block.createdAt as createdAt',
        ])

      const keyset = new TimeCidKeyset(
        ref('actor_block.createdAt'),
        ref('actor_block.cid'),
      )
      blocksReq = paginate(blocksReq, {
        limit,
        cursor,
        keyset,
      })

      const blocksRes = await blocksReq.execute()

      const actorService = services.appView.actor(db)
      const blocks = await actorService.views.profile(blocksRes, requester)

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
