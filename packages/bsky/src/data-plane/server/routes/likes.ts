import assert from 'node:assert'
import type { ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { keyBy } from '@atproto/common'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getKnownLikers(req) {
    const { actorDid, subjectUris, limit } = req
    const results = await Promise.all(
      subjectUris.map(async (subjectUri) => {
        if (limit <= 0) {
          return { subjectUri, count: 0, dids: [] }
        }
        const recentLikes = db.db
          .selectFrom('like')
          .where('like.subject', '=', subjectUri)
          .orderBy('like.sortAt', 'desc')
          .select(['like.creator', 'like.sortAt'])
          .limit(500)
          .as('recentLikes')
        const knownLikers = await db.db
          .selectFrom(recentLikes)
          .innerJoin('follow', (join) =>
            join
              .onRef('follow.subjectDid', '=', 'recentLikes.creator')
              .on('follow.creator', '=', actorDid),
          )
          .select([
            'recentLikes.creator',
            sql<number>`count(*) over()::int`.as('count'),
          ])
          .orderBy('recentLikes.sortAt', 'desc')
          .limit(limit)
          .execute()
        return {
          subjectUri,
          count: knownLikers[0]?.count ?? 0,
          dids: knownLikers.map((like) => like.creator),
        }
      }),
    )
    return { results }
  },

  async getLikesBySubjectSorted(req) {
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

    const page = keyset.page(await builder.execute(), limit)

    return {
      uris: page.items.map((l) => l.uri),
      cursor: page.cursor,
    }
  },

  // @NOTE deprecated in favor of getLikesBySubjectSorted
  async getLikesBySubject(req, context) {
    assert(this.getLikesBySubjectSorted)
    return this.getLikesBySubjectSorted(req, context)
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
    const uris = refs.map(({ uri }) => bySubject.get(uri)?.uri ?? '')
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

    const page = keyset.page(await builder.execute(), limit)

    return {
      likes: page.items.map((l) => ({
        uri: l.uri,
        subject: l.subject,
      })),
      cursor: page.cursor,
    }
  },
})
