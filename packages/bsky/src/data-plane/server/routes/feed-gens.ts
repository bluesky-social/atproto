import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/bsky_connect'
import { Database } from '../db'
import { TimeCidKeyset, paginate } from '../db/pagination'

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
    const feeds = await builder.execute()

    return {
      uris: feeds.map((f) => f.uri),
      cursor: keyset.packFromResult(feeds),
    }
  },

  async getSuggestedFeeds() {
    const feeds = await db.db
      .selectFrom('suggested_feed')
      .orderBy('suggested_feed.order', 'asc')
      .selectAll()
      .execute()
    return {
      uris: feeds.map((f) => f.uri),
    }
  },

  async getFeedGeneratorStatus() {
    throw new Error('unimplemented')
  },
})
