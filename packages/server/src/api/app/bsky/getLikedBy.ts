import { Server } from '../../../lexicon'
import * as GetLikedBy from '../../../lexicon/types/app/bsky/getLikedBy'
import * as locals from '../../../locals'
import { paginate } from '../../../db/util'
import { sql } from 'kysely'

export default function (server: Server) {
  server.app.bsky.getLikedBy(
    async (params: GetLikedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before } = params
      const { db } = locals.get(res)

      let builder = db.db
        .selectFrom('app_bsky_like as like')
        .where('like.subject', '=', uri)
        .innerJoin('record', 'like.uri', 'record.uri')
        .innerJoin('user', 'like.creator', 'user.did')
        .leftJoin('app_bsky_profile as profile', 'profile.creator', 'user.did')
        .select([
          'user.did as did',
          'user.username as name',
          'profile.displayName as displayName',
          'like.createdAt as createdAt',
          'record.indexedAt as indexedAt',
        ])

      builder = paginate(builder, {
        limit,
        before,
        by: sql`like.createdAt`,
      })

      const likedByRes = await builder.execute()

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
