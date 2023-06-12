import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      if (ctx.canProxy(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.graph.getFollowers(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { actor, limit, cursor } = params
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.appView.actor(db)
      const graphService = services.appView.graph(db)

      const subjectRes = await actorService.getActor(actor)
      if (!subjectRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let followersReq = ctx.db.db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', subjectRes.did)
        .innerJoin('did_handle as creator', 'creator.did', 'follow.creator')
        .innerJoin(
          'repo_root as creator_repo',
          'creator_repo.did',
          'follow.creator',
        )
        .where(notSoftDeletedClause(ref('creator_repo')))
        .whereNotExists(
          graphService.blockQb(requester, [ref('follow.subjectDid')]),
        )
        .selectAll('creator')
        .select(['follow.cid as cid', 'follow.createdAt as createdAt'])

      const keyset = new TimeCidKeyset(
        ref('follow.createdAt'),
        ref('follow.cid'),
      )
      followersReq = paginate(followersReq, {
        limit,
        cursor,
        keyset,
      })

      const followersRes = await followersReq.execute()
      const [followers, subject] = await Promise.all([
        actorService.views.profile(followersRes, requester),
        actorService.views.profile(subjectRes, requester),
      ])

      return {
        encoding: 'application/json',
        body: {
          subject,
          followers,
          cursor: keyset.packFromResult(followersRes),
        },
      }
    },
  })
}
