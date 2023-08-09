import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'
import { authPassthru } from '../../../../../api/com/atproto/admin/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.accessOrRoleVerifier,
    handler: async ({ req, params, auth }) => {
      const requester =
        auth.credentials.type === 'access' ? auth.credentials.did : null
      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.graph.getFollows(
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

      const creatorRes = await actorService.getActor(
        actor,
        canViewTakendownProfile,
      )
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let followsReq = ctx.db.db
        .selectFrom('follow')
        .where('follow.creator', '=', creatorRes.did)
        .innerJoin('did_handle as subject', 'subject.did', 'follow.subjectDid')
        .innerJoin(
          'repo_root as subject_repo',
          'subject_repo.did',
          'follow.subjectDid',
        )
        .if(!canViewTakendownProfile, (qb) =>
          qb.where(notSoftDeletedClause(ref('subject_repo'))),
        )
        .whereNotExists(
          graphService.blockQb(requester, [ref('follow.subjectDid')]),
        )
        .whereNotExists(
          graphService.blockRefQb(
            ref('follow.subjectDid'),
            ref('follow.creator'),
          ),
        )
        .selectAll('subject')
        .select(['follow.cid as cid', 'follow.createdAt as createdAt'])

      const keyset = new TimeCidKeyset(
        ref('follow.createdAt'),
        ref('follow.cid'),
      )
      followsReq = paginate(followsReq, {
        limit,
        cursor,
        keyset,
      })

      const followsRes = await followsReq.execute()
      const [follows, subject] = await Promise.all([
        actorService.views.hydrateProfiles(followsRes, requester, {
          includeSoftDeleted: canViewTakendownProfile,
        }),
        actorService.views.profile(creatorRes, requester, {
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
          follows,
          cursor: keyset.packFromResult(followsRes),
        },
      }
    },
  })
}
