import { sql } from 'kysely'
import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as GetUserFollowers from '../../../lexicon/types/todo/social/getUserFollowers'
import * as util from './util'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getUserFollowers(
    async (params: GetUserFollowers.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)

      const subject = await util.getUserInfo(db.db, user).catch((e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followersReq = db.db
        .selectFrom('todo_social_follow as follow')
        .where('follow.subject', '=', subject.did)
        .innerJoin('record', 'record.uri', 'follow.uri')
        .innerJoin('user as creator', 'creator.did', 'record.did')
        .leftJoin(
          'todo_social_profile as profile',
          'profile.creator',
          'record.did',
        )
        .select([
          'creator.did as did',
          'creator.username as name',
          'profile.displayName as displayName',
          'follow.createdAt as createdAt',
          'record.indexedAt as indexedAt',
        ])

      followersReq = paginate(followersReq, {
        limit,
        before,
        by: sql`follow.createdAt`,
      })

      const followersRes = await followersReq.execute()
      const followers = followersRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject,
          followers,
        },
      }
    },
  )
}
