import { keyBy } from '@atproto/common'
import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getRepostsBySubject(req) {
    const { subject, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('repost')
      .where('repost.subject', '=', subject?.uri ?? '')
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

  async getRepostsByActorAndSubjects(req) {
    const { actorDid, refs } = req
    if (refs.length === 0) {
      return { uris: [] }
    }
    const res = await db.db
      .selectFrom('repost')
      .where('creator', '=', actorDid)
      .where(
        'subject',
        'in',
        refs.map(({ uri }) => uri),
      )
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subject')
    // @TODO handling undefineds properly, or do we need to turn them into empty strings?
    const uris = refs.map(({ uri }) => bySubject[uri]?.uri)
    return { uris }
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

  async getRepostCounts(req) {
    const uris = req.refs.map((ref) => ref.uri)
    if (uris.length === 0) {
      return { counts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', 'in', uris)
      .selectAll()
      .execute()
    const byUri = keyBy(res, 'uri')
    const counts = uris.map((uri) => byUri[uri]?.repostCount ?? 0)
    return { counts }
  },
})
