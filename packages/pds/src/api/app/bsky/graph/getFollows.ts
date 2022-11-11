import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetFollows from '../../../../lexicon/types/app/bsky/graph/getFollows'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getFollows(
    async (params: GetFollows.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const creator = await getActorInfo(db.db, user).catch((_e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followsReq = db.db
        .selectFrom('follow')
        .where('follow.creator', '=', creator.did)
        .innerJoin('did_handle as subject', 'subject.did', 'follow.subjectDid')
        .leftJoin('profile', 'profile.creator', 'follow.subjectDid')
        .select([
          'subject.did as did',
          'subject.declarationCid as declarationCid',
          'subject.actorType as actorType',
          'subject.handle as handle',
          'profile.displayName as displayName',
          'follow.createdAt as createdAt',
          'follow.indexedAt as indexedAt',
        ])

      followsReq = paginate(followsReq, {
        limit,
        before,
        by: ref('follow.createdAt'),
      })

      const followsRes = await followsReq.execute()
      const follows = followsRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName ?? undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject: creator,
          follows,
          cursor: follows.at(-1)?.createdAt,
        },
      }
    },
  )
}
