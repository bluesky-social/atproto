import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetFollowers from '../../../../lexicon/types/app/bsky/graph/getFollowers'
import { getActorInfo, getDeclarationSimple } from '../util'
import * as locals from '../../../../locals'
import { paginate, TimeCidKeyset } from '../../../../db/pagination'

export default function (server: Server) {
  server.app.bsky.graph.getFollowers(
    async (params: GetFollowers.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await getActorInfo(db.db, user).catch((_e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followersReq = db.db
        .selectFrom('follow')
        .where('follow.subjectDid', '=', subject.did)
        .innerJoin('did_handle as creator', 'creator.did', 'follow.creator')
        .leftJoin('profile', 'profile.creator', 'follow.creator')
        .select([
          'creator.did as did',
          'creator.declarationCid as declarationCid',
          'creator.actorType as actorType',
          'creator.handle as handle',
          'profile.displayName as displayName',
          'follow.cid as cid',
          'follow.createdAt as createdAt',
          'follow.indexedAt as indexedAt',
        ])

      const keyset = new TimeCidKeyset(
        ref('follow.createdAt'),
        ref('follow.cid'),
      )
      followersReq = paginate(followersReq, {
        limit,
        before,
        keyset,
      })

      const followersRes = await followersReq.execute()
      const followers = followersRes.map((row) => ({
        did: row.did,
        declaration: getDeclarationSimple(row),
        handle: row.handle,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          followers,
          cursor: keyset.packFromResult(followersRes),
        },
      }
    },
  )
}
