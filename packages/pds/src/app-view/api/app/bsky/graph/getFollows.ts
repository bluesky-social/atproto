import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { notSoftDeletedClause } from '../../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getFollows({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = db.db.dynamic

      const actorService = services.appView.actor(db)

      const creatorRes = await actorService.getActor(actor)
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
        .where(notSoftDeletedClause(ref('subject_repo')))
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
        actorService.views.profile(followsRes, requester),
        actorService.views.profile(creatorRes, requester),
      ])

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
