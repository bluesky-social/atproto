import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetMemberships from '../../../../lexicon/types/app/bsky/graph/getMemberships'
import * as util from '../util'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getMemberships(
    async (params: GetMemberships.QueryParams, _input, _req, res) => {
      const { actor, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await util.getActorInfo(db.db, actor).catch((_e) => {
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
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      membershipsReq = paginate(membershipsReq, {
        limit,
        before,
        by: ref('assertion.createdAt'),
      })

      const membershipsRes = await membershipsReq.execute()
      const memberships = membershipsRes.map((row) => ({
        did: row.did,
        handle: row.handle,
        declaration: {
          cid: row.declarationCid,
          actorType: row.actorType,
        },
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          memberships,
          cursor: memberships.at(-1)?.createdAt,
        },
      }
    },
  )
}
