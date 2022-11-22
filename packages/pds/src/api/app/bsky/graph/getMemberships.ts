import { sql } from 'kysely'
import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetMemberships from '../../../../lexicon/types/app/bsky/graph/getMemberships'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { Keyset, paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getMemberships(
    async (params: GetMemberships.QueryParams, _input, _req, res) => {
      const { actor, limit, before } = params
      const { db } = locals.get(res)

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
          'assertion.uri as uri',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      const keyset = new MembershipsKeyset()
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
  )
}

class MembershipsKeyset extends Keyset {
  primary = sql`assertion."createdAt"`
  secondary = sql`assertion.uri`
}
