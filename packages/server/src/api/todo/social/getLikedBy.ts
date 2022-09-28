import { Server } from '../../../lexicon'
import * as GetLikedBy from '../../../lexicon/types/todo/social/getLikedBy'
import { AdxRecord } from '../../../db/record'
import { LikeIndex } from '../../../db/records/like'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getLikedBy(
    async (params: GetLikedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before } = params
      const { db } = getLocals(res)

      const builder = db.db
        .createQueryBuilder()
        .select([
          'user.did AS did',
          'user.username AS name',
          'profile.displayName AS displayName',
          'like.createdAt AS createdAt',
          'record.indexedAt AS indexedAt',
        ])
        .from(LikeIndex, 'like')
        .leftJoin(AdxRecord, 'record', 'like.uri = record.uri')
        .leftJoin(User, 'user', 'like.creator = user.did')
        .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
        .where('like.subject = :uri', { uri })
        .orderBy('like.createdAt')

      if (before !== undefined) {
        builder.andWhere('like.createdAt < :before', { before })
      }
      if (limit !== undefined) {
        builder.limit(limit)
      }
      const likedByRes = await builder.getRawMany()

      const likedBy = likedByRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: row.createdAt,
        indexedAt: row.indexedAt,
      }))

      return {
        encoding: 'application/json',
        body: {
          uri,
          likedBy,
        },
      }
    },
  )
}
