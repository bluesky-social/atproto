import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'
import { authOptionalVerifier } from '../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollowers({
    auth: authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.actor(db)

      const subjectRes = await actorService.getActor(actor)
      if (!subjectRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let followersReq = ctx.db.db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', subjectRes.did)
        .innerJoin('actor as creator', 'creator.did', 'follow.creator')
        .where(notSoftDeletedClause(ref('creator')))
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
