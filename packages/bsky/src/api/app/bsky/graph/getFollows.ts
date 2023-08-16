import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      const actorService = ctx.services.actor(db)
      const graphService = ctx.services.graph(db)

      const creatorRes = await actorService.getActor(actor)
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      let followsReq = db.db
        .selectFrom('follow')
        .where('follow.creator', '=', creatorRes.did)
        .innerJoin('actor as subject', 'subject.did', 'follow.subjectDid')
        .where(notSoftDeletedClause(ref('subject')))
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
        .select(['follow.cid as cid', 'follow.sortAt as sortAt'])

      const keyset = new TimeCidKeyset(ref('follow.sortAt'), ref('follow.cid'))
      followsReq = paginate(followsReq, {
        limit,
        cursor,
        keyset,
      })

      const followsRes = await followsReq.execute()
      const [follows, subject] = await Promise.all([
        actorService.views.hydrateProfiles(followsRes, requester),
        actorService.views.profile(creatorRes, requester),
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
