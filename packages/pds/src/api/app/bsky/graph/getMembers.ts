import { APP_BSKY_GRAPH, Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'
import ServerAuth from '../../../../auth'

export default function (server: Server) {
  server.app.bsky.graph.getMembers({
    auth: ServerAuth.verifier,
    handler: async ({ params, res }) => {
      const { actor, limit, before } = params
      const { db, imgUriBuilder } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await getActorInfo(db.db, imgUriBuilder, actor).catch(
        (_e) => {
          throw new InvalidRequestError(`Actor not found: ${actor}`)
        },
      )

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
          'profile.avatarCid as avatarCid',
          'assertion.cid as cid',
          'assertion.createdAt as createdAt',
          'assertion.indexedAt as indexedAt',
        ])

      const keyset = new TimeCidKeyset(
        ref('assertion.createdAt'),
        ref('assertion.cid'),
      )
      membersReq = paginate(membersReq, {
        limit,
        before,
        keyset,
      })

      const membersRes = await membersReq.execute()
      const members = membersRes.map((row) => ({
        did: row.did,
        handle: row.handle,
        declaration: getDeclarationSimple(row),
        displayName: row.displayName || undefined,
        avatar: row.avatarCid
          ? imgUriBuilder.getCommonSignedUri('avatar', row.avatarCid)
          : undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          members,
          cursor: keyset.packFromResult(membersRes),
        },
      }
    },
  })
}
