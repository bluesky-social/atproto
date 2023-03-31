import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getMutes({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.did
      const { services, db } = ctx
      const { ref } = ctx.db.db.dynamic

      let mutesReq = ctx.db.db
        .selectFrom('mute')
        .innerJoin('did_handle as actor', 'actor.did', 'mute.did')
        .innerJoin('repo_root', 'repo_root.did', 'mute.did')
        .where(notSoftDeletedClause(ref('repo_root')))
        .where('mute.mutedByDid', '=', requester)
        .selectAll('actor')
        .select('mute.createdAt as createdAt')

      const keyset = new CreatedAtDidKeyset(
        ref('mute.createdAt'),
        ref('mute.did'),
      )
      mutesReq = paginate(mutesReq, {
        limit,
        cursor,
        keyset,
      })

      const mutesRes = await mutesReq.execute()

      // @NOTE calling into app-view, will eventually be replaced
      const actorService = services.appView.actor(db)

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(mutesRes),
          mutes: await actorService.views.profile(mutesRes, requester),
        },
      }
    },
  })
}

export class CreatedAtDidKeyset extends TimeCidKeyset<{
  createdAt: string
  did: string // dids are treated identically to cids in TimeCidKeyset
}> {
  labelResult(result: { createdAt: string; did: string }) {
    return { primary: result.createdAt, secondary: result.did }
  }
}
