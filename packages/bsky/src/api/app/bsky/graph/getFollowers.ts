import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: ctx.authOptionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = 'did' in auth.credentials ? auth.credentials.did : null
      const canViewTakendownProfile =
        auth.credentials.type === 'role' && auth.credentials.triage
      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)

      const subjectRes = await actorService.getActor(
        actor,
        canViewTakendownProfile,
      )
      if (!subjectRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let followersReq = db.db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', subjectRes.did)
        .innerJoin('actor as creator', 'creator.did', 'follow.creator')
        .if(!canViewTakendownProfile, (qb) =>
          qb.where(notSoftDeletedClause(ref('creator'))),
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
        .select(['follow.cid as cid', 'follow.sortAt as sortAt'])

      const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
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
