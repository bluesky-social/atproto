import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getActorInfo, getDeclarationSimple } from '../util'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.getMemberships({
    auth: ctx.accessVerifier,
    handler: async ({ params }) => {
      const { actor, limit, before } = params
      const { ref } = ctx.db.db.dynamic

      const subject = await getActorInfo(
        ctx.db.db,
        ctx.imgUriBuilder,
        actor,
      ).catch((_e) => {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      })

      let membershipsReq = ctx.db.db
        .selectFrom('assertion')
        .where('assertion.subjectDid', '=', subject.did)
        .innerJoin('did_handle as creator', 'creator.did', 'assertion.creator')
        .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
        .where('assertion.confirmUri', 'is not', null)
        .leftJoin('profile', 'profile.creator', 'creator.did')
        .select([
          'creator.did as did',
          'creator.handle as handle',
          'creator.declarationCid as declarationCid',
          'creator.actorType as actorType',
          'profile.displayName as displayName',
          'profile.avatarCid as avatarCid',
          'assertion.cid as cid',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      const keyset = new TimeCidKeyset(
        ref('assertion.createdAt'),
        ref('assertion.cid'),
      )
      membershipsReq = paginate(membershipsReq, {
        limit,
        before,
        keyset,
      })

      const membershipsRes = await membershipsReq.execute()
      const memberships = membershipsRes.map((row) => ({
        did: row.did,
        handle: row.handle,
        declaration: getDeclarationSimple(row),
        displayName: row.displayName || undefined,
        avatar: row.avatarCid
          ? ctx.imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          memberships,
          cursor: keyset.packFromResult(membershipsRes),
        },
      }
    },
  })
}
