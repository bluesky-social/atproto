import { Server } from '../../../lexicon'
import * as GetLikedBy from '../../../lexicon/types/todo/social/getLikedBy'
import * as locals from '../../../locals'
import { dateFromDb, dateToDb } from '../../../db/util'

export default function (server: Server) {
  server.todo.social.getLikedBy(
    async (params: GetLikedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before } = params
      const { db } = locals.get(res)

      const builder = db.db
        .selectFrom('todo_social_like as like')
        .where('like.subject', '=', uri)
        .innerJoin('record', 'like.uri', 'record.uri')
        .innerJoin('user', 'like.creator', 'user.did')
        .leftJoin(
          'todo_social_profile as profile',
          'profile.creator',
          'user.did',
        )
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'like.createdAt as createdAt',
          'record.indexedAt as indexedAt',
        ])

      // Pagination
      builder.orderBy('like.createdAt', 'desc')
      if (before !== undefined) {
        builder.where('like.createdAt', '<', dateToDb(before))
      }
      if (limit !== undefined) {
        builder.limit(limit)
      }

      const likedByRes = await builder.execute()

      const likedBy = likedByRes.map((row) => ({
        did: row.did,
        name: row.name,
        displayName: row.displayName || undefined,
        createdAt: dateFromDb(row.createdAt),
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
