import { Server } from '../../../lexicon'
import * as GetUserFollowers from '../../../lexicon/types/todo/social/getUserFollowers'
import { AdxRecord } from '../../../db/record'
import { FollowIndex } from '../../../db/records/follow'
import { ProfileIndex } from '../../../db/records/profile'
import { UserDid } from '../../../db/user-dids'
import * as util from './util'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getUserFollowers(
    async (params: GetUserFollowers.QueryParams, _input, _req, res) => {
      const { user, limit, before } = params
      const { db } = getLocals(res)

      const subject = await util.getUserInfo(db.db, user)

      const followersReq = db.db
        .createQueryBuilder()
        .select([
          'creator.did AS did',
          'creator.username AS name',
          'profile.displayName AS displayName',
          'follow.createdAt AS createdAt',
          'record.indexedAt AS indexedAt',
        ])
        .from(FollowIndex, 'follow')
        .innerJoin(AdxRecord, 'record', 'record.uri = follow.uri')
        .innerJoin(UserDid, 'creator', 'creator.did = record.did')
        .leftJoin(ProfileIndex, 'profile', 'profile.creator = record.did')
        .where('follow.subject = :subject', { subject: subject.did })
        .orderBy('follow.createdAt')

      if (before !== undefined) {
        followersReq.andWhere('follow.createdAt < :before', { before })
      }
      if (limit !== undefined) {
        followersReq.limit(limit)
      }

      const followersRes = await followersReq.getRawMany()
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
