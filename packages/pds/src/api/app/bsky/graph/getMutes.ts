import { Server } from '../../../../lexicon'
import { getDeclarationSimple } from '../util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getMutes({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const { limit, before } = params
      const requester = auth.credentials.did
      const { ref } = ctx.db.db.dynamic

      let mutesReq = ctx.db.db
        .selectFrom('mute')
        .innerJoin('did_handle as actor', 'actor.did', 'mute.did') // TODO omit soft deleted
        .leftJoin('profile', 'profile.creator', 'mute.did')
        .where('mute.mutedByDid', '=', requester)
        .select([
          'mute.did as did',
          'mute.createdAt as createdAt',
          'actor.handle as handle',
          'actor.declarationCid as declarationCid',
          'actor.actorType as actorType',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
        ])

      const keyset = new CreatedAtDidKeyset(
        ref('mute.createdAt'),
        ref('mute.did'),
      )
      mutesReq = paginate(mutesReq, {
        limit,
        before,
        keyset,
      })

      const mutesRes = await mutesReq.execute()
      const mutes = mutesRes.map((row) => ({
        did: row.did,
        handle: row.handle,
        declaration: getDeclarationSimple(row),
        displayName: row.displayName || undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.createdAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          mutes,
          cursor: keyset.packFromResult(mutesRes),
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
