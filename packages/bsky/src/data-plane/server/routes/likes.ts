import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { TimeCidKeyset, paginate } from '../../../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLikesBySubject(req) {
    const { subjectUri, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('like')
      .where('like.subject', '=', subjectUri)
      .innerJoin('actor as creator', 'creator.did', 'like.creator')
      .selectAll('creator')
      .select([
        'like.uri as uri',
        'like.cid as cid',
        'like.createdAt as createdAt',
        'like.indexedAt as indexedAt',
        'like.sortAt as sortAt',
      ])

    const keyset = new TimeCidKeyset(ref('like.sortAt'), ref('like.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const likes = await builder.execute()

    return {
      uris: likes.map((l) => l.uri),
      cursor: keyset.packFromResult(likes),
    }
  },
  async getLikeByActorAndSubject(req) {
    const { actorDid, subjectUri } = req
    const res = await db.db
      .selectFrom('like')
      .where('creator', '=', actorDid)
      .where('subject', '=', subjectUri)
      .select('uri')
      .executeTakeFirst()
    return { uri: res?.uri }
  },
  async getActorLikes(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('like')
      .where('like.creator', '=', actorDid)
      .selectAll()

    const keyset = new TimeCidKeyset(ref('like.sortAt'), ref('like.cid'))

    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const likes = await builder.execute()

    return {
      uris: likes.map((l) => l.uri),
      cursor: keyset.packFromResult(likes),
    }
  },
  async getLikesCount(req) {
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', '=', req.subjectUri)
      .select('likeCount')
      .executeTakeFirst()
    return {
      count: res?.likeCount,
    }
  },
})
