import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'
import { authPassthru } from '../../../../../api/com/atproto/admin/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.graph.getFollowers(
          params,
          requester
            ? await ctx.serviceAuthHeaders(requester)
            : authPassthru(req),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage
      const { actor, limit, cursor } = params
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.appView.actor(db)
      const graphService = services.appView.graph(db)

      const subjectRes = await actorService.getActor(
        actor,
        canViewTakendownProfile,
      )
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
        .if(canViewTakendownProfile, (qb) =>
          qb.where(notSoftDeletedClause(ref('creator_repo'))),
        )
        .whereNotExists(
          graphService.blockQb(requester, [ref('follow.creator')]),
        )
        .whereNotExists(
          graphService.blockRefQb(
            ref('follow.subjectDid'),
            ref('follow.creator'),
          ),
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
        actorService.views.hydrateProfiles(followersRes, requester, {
          includeSoftDeleted: canViewTakendownProfile,
        }),
        actorService.views.profile(subjectRes, requester, {
          includeSoftDeleted: canViewTakendownProfile,
        }),
      ])
      if (!subject) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

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
