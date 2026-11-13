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
    const results = subjectUris.map((subjectUri) => ({
      subjectUri,
      count: 0,
      dids: [] as string[],
    }))
    if (limit <= 0 || subjectUris.length === 0) return { results }

    const { rows } = await sql<{
      ordinal: string
      creator: string
      count: number
    }>`
      with "rankedKnownLikers" as (
        select
          subjects.ordinal,
          "recentLikes".creator,
          count(*) over (partition by subjects.ordinal)::int as count,
          row_number() over (
            partition by subjects.ordinal
            order by "recentLikes"."sortAt" desc
          ) as rank
        from unnest(${subjectUris}::varchar[]) with ordinality
          as subjects("subjectUri", ordinal)
        cross join lateral (
          select "like".creator, "like"."sortAt"
          from "like"
          where "like".subject = subjects."subjectUri"
          order by "like"."sortAt" desc
          limit 500
        ) as "recentLikes"
        inner join follow on
          follow."subjectDid" = "recentLikes".creator
          and follow.creator = ${actorDid}
      )
      select ordinal, creator, count
      from "rankedKnownLikers"
      where rank <= ${limit}
      order by ordinal, rank
    `.execute(db.db)

    for (const row of rows) {
      const result = results[Number(row.ordinal) - 1]
      assert(result)
      result.count = row.count
      result.dids.push(row.creator)
    }
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
