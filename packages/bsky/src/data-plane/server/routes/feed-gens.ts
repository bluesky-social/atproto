import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../gen/bsky_connect'
import * as ui8 from 'uint8arrays'
import { Database } from '../../../db'
import { keyBy } from '@atproto/common'
import { TimeCidKeyset, paginate } from '../../../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getFeedGenerators(req) {
    if (req.uris.length === 0) {
      return { records: [] }
    }
    const res = await db.db
      .selectFrom('record')
      .selectAll()
      .where('uri', 'in', req.uris)
      .execute()
    const byUri = keyBy(res, 'uri')
    const records = req.uris.map((uri) => {
      const row = byUri[uri]
      const json = row ? row.json : JSON.stringify(null)
      return ui8.fromString(json, 'utf8')
    })
    return { records }
  },

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
