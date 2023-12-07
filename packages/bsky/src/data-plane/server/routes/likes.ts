import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../../../db'
import { TimeCidKeyset, paginate } from '../../../db/pagination'
import { keyBy } from '@atproto/common'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLikesBySubject(req) {
    const { subjectUri, cursor, limit } = req
    const { ref } = db.db.dynamic

    let builder = db.db
      .selectFrom('like')
      .where('like.subject', '=', subjectUri)
      .selectAll('like')

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

  async getLikesByActorAndSubjects(req) {
    const { actorDid, subjectUris } = req
    if (subjectUris.length === 0) {
      return { uris: [] }
    }
    const res = await db.db
      .selectFrom('like')
      .where('creator', '=', actorDid)
      .where('subject', 'in', subjectUris)
      .selectAll()
      .execute()
    const bySubject = keyBy(res, 'subject')
    const uris = req.subjectUris.map((uri) => bySubject[uri]?.uri)
    return { uris }
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

  async getLikeCounts(req) {
    if (req.uris.length === 0) {
      return { counts: [] }
    }
    const res = await db.db
      .selectFrom('post_agg')
      .where('uri', 'in', req.uris)
      .selectAll()
      .execute()
    const byUri = keyBy(res, 'uri')
    const counts = req.uris.map((uri) => byUri[uri]?.likeCount ?? 0)
    return { counts }
  },
})
