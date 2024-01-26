import { Server } from '../../../../lexicon'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { notSoftDeletedClause } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getMutes({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const { limit, cursor } = params
      const requester = auth.credentials.iss
      if (TimeCidKeyset.clearlyBad(cursor)) {
        return {
          encoding: 'application/json',
          body: { mutes: [] },
        }
      }

      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      let mutesReq = db.db
        .selectFrom('mute')
        .innerJoin('actor', 'actor.did', 'mute.subjectDid')
        .where(notSoftDeletedClause(ref('actor')))
        .where('mute.mutedByDid', '=', requester)
        .selectAll('actor')
        .select('mute.createdAt as createdAt')

      const keyset = new CreatedAtDidKeyset(
        ref('mute.createdAt'),
        ref('mute.subjectDid'),
      )
      mutesReq = paginate(mutesReq, {
        limit,
        cursor,
        keyset,
      })

      const mutesRes = await mutesReq.execute()

      const actorService = ctx.services.actor(db)

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(mutesRes),
          mutes: await actorService.views.profilesList(mutesRes, requester),
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
