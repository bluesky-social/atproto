import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import {
  IndexedAtDidKeyset,
  TimeCidKeyset,
  paginate,
} from '../db/pagination.js'
import { parsePostSearchQuery } from '../util.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => {
  const searchActorsImpl = async (req: {
    term: string
    limit: number
    cursor?: string
  }) => {
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
  }

  const searchPostsImpl = async (req: {
    term: string
    limit: number
    cursor?: string
  }) => {
    const { term, limit, cursor } = req
    const { q, author } = parsePostSearchQuery(term)

    let authorDid = author
    if (author && !author?.startsWith('did:')) {
      const res = await db.db
        .selectFrom('actor')
        .where('handle', '=', author)
        .selectAll()
        .executeTakeFirst()
      authorDid = res?.did
    }

    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('post')
      .where('post.text', 'like', `%${q}%`)
      .selectAll()

    if (authorDid) {
      builder = builder.where('post.creator', '=', authorDid)
    }

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
  }

  const searchStarterPacksImpl = async (req: {
    term: string
    limit: number
    cursor?: string
  }) => {
    const { term, limit, cursor } = req
    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('starter_pack')
      .where('starter_pack.name', 'ilike', `%${term}%`)
      .selectAll()

    const keyset = new TimeCidKeyset(
      ref('starter_pack.sortAt'),
      ref('starter_pack.cid'),
    )

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
  }

  return {
    // @TODO actor search endpoints still fall back to search service
    searchActors: searchActorsImpl,

    // @TODO post search endpoint still falls back to search service
    searchPosts: searchPostsImpl,

    searchStarterPacks: searchStarterPacksImpl,

    // V2 endpoints reuse the V1 SQL for dev env and reshape the response.
    async searchActorsV2(req) {
      const { dids, cursor } = await searchActorsImpl({
        term: req.params?.query ?? '',
        limit: req.params?.limit ?? 25,
        cursor: req.params?.cursor,
      })
      return {
        actors: dids.map((did) => ({ did, score: 0 })),
        pageInfo: { cursor: cursor ?? '', hitsTotal: 0n },
      }
    },

    async searchActorsTypeahead(req) {
      const { dids } = await searchActorsImpl({
        term: req.params?.query ?? '',
        limit: req.params?.limit || 10,
      })
      return {
        actors: dids.map((did) => ({ did, score: 0 })),
      }
    },

    async searchPostsV2(req) {
      const author = req.filters?.authors?.[0]
      const baseQuery = req.params?.query ?? ''
      const term = author ? `${baseQuery} from:${author}` : baseQuery
      const { uris, cursor } = await searchPostsImpl({
        term,
        limit: req.params?.limit ?? 25,
        cursor: req.params?.cursor,
      })
      return {
        posts: uris.map((uri) => ({ uri, score: 0 })),
        pageInfo: { cursor: cursor ?? '', hitsTotal: 0n },
        detectedQueryLanguages: [],
      }
    },

    async searchStarterPacksV2(req) {
      const { uris, cursor } = await searchStarterPacksImpl({
        term: req.params?.query ?? '',
        limit: req.params?.limit ?? 25,
        cursor: req.params?.cursor,
      })
      return {
        starterPacks: uris.map((uri) => ({ uri, score: 0 })),
        pageInfo: { cursor: cursor ?? '', hitsTotal: 0n },
      }
    },
  }
}

// Remove leading @ in case a handle is input that way
const cleanQuery = (query: string) => query.trim().replace(/^@/g, '')
