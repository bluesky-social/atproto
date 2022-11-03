import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as GetFollowers from '../../../../lexicon/types/app/bsky/graph/getFollowers'
import * as util from '../util'
import * as locals from '../../../../locals'
import { paginate } from '../../../../db/util'

export default function (server: Server) {
  server.app.bsky.graph.getFollowers(
    async (params: GetFollowers.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)
      const { ref } = db.db.dynamic

      const subject = await util.getUserInfo(db.db, user).catch((_e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followersReq = db.db
        .selectFrom('app_bsky_follow as follow')
        .where('follow.subjectDid', '=', subject.did)
        .innerJoin('user_did as creator', 'creator.did', 'follow.creator')
        .leftJoin(
          'app_bsky_profile as profile',
          'profile.creator',
          'follow.creator',
        )
        .select([
          'creator.did as did',
          'creator.handle as handle',
          'profile.displayName as displayName',
          'follow.createdAt as createdAt',
          'follow.indexedAt as indexedAt',
        ])

      followersReq = paginate(followersReq, {
        limit,
        before,
        by: ref('follow.createdAt'),
      })

      const followersRes = await followersReq.execute()
      const followers = followersRes.map((row) => ({
        did: row.did,
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
          cursor: followers.at(-1)?.createdAt,
        },
      }
    },
  )
}
