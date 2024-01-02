import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'
import { keyBy } from '@atproto/common'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getLikesBySubject(req) {
    const { subject, cursor, limit } = req
    const { ref } = db.db.dynamic

    if (!subject?.uri) {
      return { uris: [] }
    }

    // @NOTE ignoring subject.cid
    let builder = db.db
      .selectFrom('like')
      .where('like.subject', '=', subject?.uri)
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
    const { actorDid, refs } = req
    if (refs.length === 0) {
      return { uris: [] }
    }
    // @NOTE ignoring ref.cid
    const res = await db.db
      .selectFrom('like')
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
      likes: likes.map((l) => ({
        uri: l.uri,
        subject: l.subject,
      })),
      cursor: keyset.packFromResult(likes),
    }
  },

  async getLikeCounts(req) {
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
    const counts = uris.map((uri) => byUri[uri]?.likeCount ?? 0)
    return { counts }
  },
})
