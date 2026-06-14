import { ServiceImpl } from '@connectrpc/connect'
import { Service } from '../../../proto/sokaa_connect'
import { Database } from '../db'
import {
  CreatedAtCidKeyset,
  mergePaginatedPosts,
  paginate,
} from '../db/pagination'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getTimeline(req) {
    const { actorDid, limit = 50, cursor } = req
    const { ref } = db.db.dynamic
    const keyset = new CreatedAtCidKeyset(
      ref('post.createdAt'),
      ref('post.cid'),
    )

    let followQb = db.db
      .selectFrom('post')
      .innerJoin('follow', 'follow.subjectDid', 'post.creator')
      .where('follow.creator', '=', actorDid)
      .selectAll('post')

    followQb = paginate(followQb, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    let selfQb = db.db
      .selectFrom('post')
      .where('post.creator', '=', actorDid)
      .selectAll('post')

    selfQb = paginate(selfQb, {
      limit: Math.min(limit, 10),
      cursor,
      keyset,
      tryIndex: true,
    })

    const [followRes, selfRes] = await Promise.all([
      followQb.execute(),
      selfQb.execute(),
    ])

    const posts = mergePaginatedPosts(followRes, selfRes, limit)

    return {
      items: posts.map((post) => ({ uri: post.uri, cid: post.cid })),
      cursor: keyset.packFromResult(posts),
    }
  },

  async getAuthorFeed(req) {
    const { actorDid, limit = 50, cursor } = req
    const { ref } = db.db.dynamic
    const keyset = new CreatedAtCidKeyset(
      ref('post.createdAt'),
      ref('post.cid'),
    )

    let builder = db.db
      .selectFrom('post')
      .where('creator', '=', actorDid)
      .selectAll('post')

    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
      tryIndex: true,
    })

    const posts = await builder.execute()

    return {
      items: posts.map((post) => ({ uri: post.uri, cid: post.cid })),
      cursor: keyset.packFromResult(posts),
    }
  },
})
