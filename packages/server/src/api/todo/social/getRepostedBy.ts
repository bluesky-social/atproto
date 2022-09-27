import { Server } from '../../../lexicon'
import * as GetRepostedBy from '../../../lexicon/types/todo/social/getRepostedBy'
import { AdxRecord } from '../../../db/record'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import { RepostIndex } from '../../../db/records/repost'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getRepostedBy(
    async (params: GetRepostedBy.QueryParams, _input, _req, res) => {
      const { uri, limit, before } = params
      const { db } = getLocals(res)

      const builder = db.db
        .createQueryBuilder()
        .select([
          'user.did AS did',
          'user.username AS name',
          'profile.displayName AS displayName',
          'repost.createdAt AS createdAt',
          'record.indexedAt AS indexedAt',
        ])
        .from(RepostIndex, 'repost')
        .leftJoin(AdxRecord, 'record', 'repost.uri = record.uri')
        .leftJoin(User, 'user', 'repost.creator = user.did')
        .leftJoin(ProfileIndex, 'profile', 'profile.creator = user.did')
        .where('repost.subject = :uri', { uri })
        .orderBy('repost.createdAt')

      if (before !== undefined) {
        builder.andWhere('repost.createdAt < :before', { before })
      }
      if (limit !== undefined) {
        builder.limit(limit)
      }
      const repostedByRes = await builder.getRawMany()

      const repostedBy = repostedByRes.map((row) => ({
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
          repostedBy,
        },
      }
    },
  )
}
