import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetMembers from '../../../../lexicon/types/app/bsky/graph/getMembers'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getMembers(
    async (params: GetMembers.QueryParams, _input, _req, res) => {
      const { actor, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await getActorInfo(db.db, actor).catch((_e) => {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      })

      let membersReq = db.db
        .selectFrom('assertion')
        .where('assertion.creator', '=', subject.did)
        .where('assertion.assertion', '=', APP_BSKY_GRAPH.AssertMember)
        .where('assertion.confirmUri', 'is not', null)
        .innerJoin(
          'did_handle as subject',
          'subject.did',
          'assertion.subjectDid',
        )
        .leftJoin('profile', 'profile.creator', 'subject.did')
        .select([
          'subject.did as did',
          'subject.handle as handle',
          'subject.declarationCid as declarationCid',
          'subject.actorType as actorType',
          'profile.displayName as displayName',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      membersReq = paginate(membersReq, {
        limit,
        before,
        by: ref('assertion.createdAt'),
      })

      const membersRes = await membersReq.execute()
      const members = membersRes.map((row) => ({
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
          members,
          cursor: members.at(-1)?.createdAt,
        },
      }
    },
  )
}
