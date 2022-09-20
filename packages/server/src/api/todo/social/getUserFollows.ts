import { Server } from '../../../xrpc'
import * as GetUserFollows from '../../../xrpc/types/todo/social/getUserFollows'
import { AdxRecord } from '../../../db/record'
import { FollowIndex } from '../../../db/records/follow'
import { ProfileIndex } from '../../../db/records/profile'
import { UserDid } from '../../../db/user-dids'
import * as util from './util'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getUserFollows(
    async (params: GetUserFollows.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = getLocals(res)

      const creator = await util.getUserInfo(db.db, user)

      const followsReq = db.db
        .createQueryBuilder()
        .select([
          'subject.did AS did',
          'subject.username AS name',
          'profile.displayName AS displayName',
          'follow.createdAt AS createdAt',
          'record.indexedAt AS indexedAt',
        ])
        .from(FollowIndex, 'follow')
        .innerJoin(AdxRecord, 'record', 'follow.uri = record.uri')
        .innerJoin(UserDid, 'subject', 'follow.subject = subject.did')
        .leftJoin(ProfileIndex, 'profile', 'profile.creator = follow.subject')
        .where('follow.creator = :creator', { creator: creator.did })
        .orderBy('follow.createdAt')

      if (before !== undefined) {
        followsReq.andWhere('follow.createdAt < :before', { before })
      }
      if (limit !== undefined) {
        followsReq.limit(limit)
      }

      const followsRes = await followsReq.getRawMany()
      const follows = followsRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
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
