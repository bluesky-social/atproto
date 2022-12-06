import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.graph.getMemberships({
    auth: ServerAuth.verifier,
    handler: async ({ params, res }) => {
      const { actor, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await getActorInfo(db.db, actor).catch((_e) => {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      })

      let membershipsReq = db.db
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
