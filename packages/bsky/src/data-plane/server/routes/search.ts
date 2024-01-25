import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { IndexedAtDidKeyset, TimeCidKeyset, paginate } from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  // @TODO actor search endpoints still fall back to search service
  async searchActors(req) {
    const { term, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('actor')
      .where('actor.handle', 'like', `%${cleanQuery(term)}%`)
      .selectAll()

    const keyset = new IndexedAtDidKeyset(
      ref('actor.indexedAt'),
      ref('actor.did'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const res = await builder.execute()

    return {
      dids: res.map((row) => row.did),
      cursor: keyset.packFromResult(res),
    }
  },

  // @TODO post search endpoint still falls back to search service
  async searchPosts(req) {
    const { term, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('post')
      .where('post.text', 'like', `%${term}%`)
      .selectAll()

    const keyset = new TimeCidKeyset(ref('post.sortAt'), ref('post.cid'))
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const res = await builder.execute()
    return {
      uris: res.map((row) => row.uri),
      cursor: keyset.packFromResult(res),
    }
  },
})

// Remove leading @ in case a handle is input that way
const cleanQuery = (query: string) => query.trim().replace(/^@/g, '')
