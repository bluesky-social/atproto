import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as GetUserFollows from '../../../lexicon/types/todo/social/getUserFollows'
import * as util from './util'
import * as locals from '../../../locals'
import { dateFromDb, dateToDb } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getUserFollows(
    async (params: GetUserFollows.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = locals.get(res)

      const creator = await util.getUserInfo(db.db, user).catch((e) => {
        throw new InvalidRequestError(`User not found: ${user}`)
      })

      let followsReq = db.db
        .selectFrom('todo_social_follow as follow')
        .where('follow.creator', '=', creator.did)
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
        .orderBy('follow.createdAt', 'desc')

      // Paginate
      if (before !== undefined) {
        followsReq = followsReq.where('follow.createdAt', '<', dateToDb(before))
      }
      if (limit !== undefined) {
        followsReq = followsReq.limit(limit)
      }

      const followsRes = await followsReq.execute()
      const follows = followsRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: dateFromDb(row.createdAt),
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          subject: creator,
          follows,
        },
      }
    },
  )
}
