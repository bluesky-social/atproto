import type { ServiceImpl } from '@connectrpc/connect'
import type { Service } from '../../../proto/bsky_connect.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getActorFeeds(req) {
    const { actorDid, limit, cursor } = req

    const { ref } = db.db.dynamic
    let builder = db.db
      .selectFrom('feed_generator')
      .selectAll()
      .where('feed_generator.creator', '=', actorDid)

    const keyset = new TimeCidKeyset(
      ref('feed_generator.createdAt'),
      ref('feed_generator.cid'),
    )
    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })
    const page = keyset.page(await builder.execute(), limit)

    return {
      uris: page.items.map((f) => f.uri),
      cursor: page.cursor,
    }
  },

  async getSuggestedFeeds(req) {
    const feeds = await db.db
      .selectFrom('suggested_feed')
      .orderBy('suggested_feed.order', 'asc')
      .$if(!!req.cursor, (q) => q.where('order', '>', parseInt(req.cursor, 10)))
      .limit((req.limit || 50) + 1)
      .selectAll()
      .execute()
    const limit = req.limit || 50
    const items = feeds.slice(0, limit)
    return {
      uris: items.map((f) => f.uri),
      cursor: feeds.length > limit ? items.at(-1)?.order.toString() : undefined,
    }
  },

  async searchFeedGenerators(req) {
    return searchFeedGeneratorsImpl(db, req.query, req.limit)
  },

  async searchFeedGeneratorsV2(req) {
    const { uris, cursor } = await searchFeedGeneratorsImpl(
      db,
      req.params?.query ?? '',
      req.params?.limit ?? 25,
      req.params?.cursor,
    )
    return {
      feedGenerators: uris.map((uri) => ({ uri, score: 0 })),
      pageInfo: { cursor: cursor ?? '', hitsTotal: 0n },
    }
  },

  async getFeedGeneratorStatus() {
    throw new Error('unimplemented')
  },
})

const searchFeedGeneratorsImpl = async (
  db: Database,
  query: string,
  limit: number,
  cursor?: string,
) => {
  const { ref } = db.db.dynamic
  const trimmed = query.trim()
  let builder = db.db
    .selectFrom('feed_generator')
    .$if(!!trimmed, (q) => q.where('displayName', 'ilike', `%${trimmed}%`))
    .selectAll()
  const keyset = new TimeCidKeyset(
    ref('feed_generator.createdAt'),
    ref('feed_generator.cid'),
  )
  builder = paginate(builder, { limit, cursor, keyset })
  const page = keyset.page(await builder.execute(), limit)
  return {
    uris: page.items.map((f) => f.uri),
    cursor: page.cursor,
  }
}
