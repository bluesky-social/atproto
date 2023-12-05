import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { TimeCidKeyset, paginate } from '../../../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getRepostsBySubject(req) {
    const { subjectUri, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('repost')
      .where('repost.subject', '=', subjectUri)
      .selectAll('repost')

    const keyset = new TimeCidKeyset(ref('repost.sortAt'), ref('repost.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const reposts = await builder.execute()

    return {
      uris: reposts.map((l) => l.uri),
      cursor: keyset.packFromResult(reposts),
    }
  },

  async getRepostByActorAndSubject(req) {
    const { actorDid, subjectUri } = req
    const res = await db.db
      .selectFrom('repost')
      .where('creator', '=', actorDid)
      .where('subject', '=', subjectUri)
      .select('uri')
      .executeTakeFirst()
    return { uri: res?.uri }
  },

  async getActorReposts(req) {
    const { actorDid, limit, cursor } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('repost')
      .where('repost.creator', '=', actorDid)
      .selectAll()

    const keyset = new TimeCidKeyset(ref('repost.sortAt'), ref('repost.cid'))

    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const reposts = await builder.execute()

    return {
      uris: reposts.map((l) => l.uri),
      cursor: keyset.packFromResult(reposts),
    }
  },

  async getRepostsCount(req) {
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', '=', req.subjectUri)
      .select('repostCount')
      .executeTakeFirst()
    return {
      count: res?.repostCount,
    }
  },
})
