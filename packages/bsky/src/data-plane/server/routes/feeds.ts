import assert from 'node:assert'
import { Code, ConnectError, type ServiceImpl } from '@connectrpc/connect'
import { app } from '../../../lexicons/index.js'
import type { Service } from '../../../proto/bsky_connect.js'
import { FeedType } from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset, paginate } from '../db/pagination.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  async getAuthorFeed(req) {
    const { actorDid, limit, cursor, feedType } = req
    const { ref } = db.db.dynamic

    // defaults to posts, reposts, and replies
    let builder = db.db
      .selectFrom('feed_item')
      .innerJoin('post', 'post.uri', 'feed_item.postUri')
      .selectAll('feed_item')
      .where('originatorDid', '=', actorDid)

    if (feedType === FeedType.POSTS_WITH_MEDIA) {
      builder = builder
        // only your own posts
        .where('type', '=', 'post')
        // only posts with media
        .where((eb) =>
          eb.or([
            eb.exists(
              eb
                .selectFrom('post_embed_image')
                .select('post_embed_image.postUri')
                .whereRef('post_embed_image.postUri', '=', 'feed_item.postUri'),
            ),
            eb.exists(
              eb
                .selectFrom('post_embed_gallery_image')
                .select('post_embed_gallery_image.postUri')
                .whereRef(
                  'post_embed_gallery_image.postUri',
                  '=',
                  'feed_item.postUri',
                ),
            ),
          ]),
        )
    } else if (feedType === FeedType.POSTS_WITH_VIDEO) {
      builder = builder
        // only your own posts
        .where('type', '=', 'post')
        // only posts with video
        .where(({ eb, exists }) =>
          exists(
            eb
              .selectFrom('post_embed_video')
              .select('post_embed_video.postUri')
              .whereRef('post_embed_video.postUri', '=', 'feed_item.postUri'),
          ),
        )
    } else if (feedType === FeedType.POSTS_NO_REPLIES) {
      builder = builder.where((eb) =>
        eb.or([eb('post.replyParent', 'is', null), eb('type', '=', 'repost')]),
      )
    } else if (feedType === FeedType.POSTS_AND_AUTHOR_THREADS) {
      builder = builder.where((eb) =>
        eb.or([
          eb('type', '=', 'repost'),
          eb('post.replyParent', 'is', null),
          eb('post.replyRoot', 'like', `at://${actorDid}/%`),
        ]),
      )
    }

    const keyset = new TimeCidKeyset(
      ref('feed_item.sortAt'),
      ref('feed_item.cid'),
    )

    builder = paginate(builder, {
      limit,
      cursor,
      keyset,
    })

    const page = keyset.page(await builder.execute(), limit)

    return {
      items: page.items.map(feedItemFromRow),
      cursor: page.cursor,
    }
  },

  async getTimeline(req) {
    const { actorDid, limit, cursor, since } = req
    const { ref } = db.db.dynamic

    const keyset = new TimeCidKeyset(
      ref('feed_item.sortAt'),
      ref('feed_item.cid'),
    )
    assertValidSince(keyset, since)

    let followQb = db.db
      .selectFrom('feed_item')
      .innerJoin('follow', 'follow.subjectDid', 'feed_item.originatorDid')
      .where('follow.creator', '=', actorDid)
      .selectAll('feed_item')

    followQb = paginate(followQb, {
      limit,
      cursor,
      since,
      keyset,
      tryIndex: true,
    })

    let selfQb = db.db
      .selectFrom('feed_item')
      .where('feed_item.originatorDid', '=', actorDid)
      .selectAll('feed_item')

    selfQb = paginate(selfQb, {
      limit,
      cursor,
      since,
      keyset,
      tryIndex: true,
    })

    const [followRes, selfRes] = await Promise.all([
      followQb.execute(),
      selfQb.execute(),
    ])

    // Use own posts to fill space left by followed-account posts. When followed-account
    // posts already fill the page, still allow up to 10 own posts into the merged results.
    const selfLimit = Math.max(
      // Allow up to 10 own posts even when followed-account posts can fill the page.
      Math.min(limit, 10),
      // Allow enough own posts to fill the slots not occupied by followed-account posts.
      limit - Math.min(followRes.length, limit),
    )

    // The extra own post proves that another page exists, but is not part of this page.
    const selfHasMore = selfRes.length > selfLimit

    const selfItems = selfRes.slice(0, selfLimit)
    const feedItems = [...followRes, ...selfItems].sort((a, b) => {
      if (a.sortAt > b.sortAt) return -1
      if (a.sortAt < b.sortAt) return 1
      return a.cid > b.cid ? -1 : 1
    })

    const page = keyset.page(feedItems, limit)
    if (page.items.length === 0) {
      return { items: [], cursor: exhaustedCursor(since) }
    }
    const items = page.items.map(feedItemFromRow)
    const startCursor = keyset.packFromResult(page.items[0])

    // The combined results exceeded the requested limit.
    if (page.cursor) {
      return { items, cursor: page.cursor, startCursor }
    }

    // Own posts exceeded their separate cap, but the combined results did not exceed the requested limit.
    if (selfHasMore) {
      const lastItem = page.items.at(-1)
      assert(lastItem)
      return { items, cursor: keyset.packFromResult(lastItem), startCursor }
    }

    return { items, cursor: exhaustedCursor(since), startCursor }
  },

  async getListFeed(req) {
    const { listUri, cursor, since, limit } = req
    const { ref } = db.db.dynamic
    const list = await db.db
      .selectFrom('list')
      .where('uri', '=', listUri)
      .select('purpose')
      .executeTakeFirst()

    let builder = db.db
      .selectFrom('post')
      .selectAll('post')
      .innerJoin('list_item', 'list_item.subjectDid', 'post.creator')
      .where('list_item.listUri', '=', listUri)

    if (list?.purpose === app.bsky.graph.defs.Referencelist) {
      builder = builder.where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('reference_list_opt_out')
              .select('uri')
              .whereRef('reference_list_opt_out.creator', '=', 'post.creator')
              .where('reference_list_opt_out.subjectUri', '=', listUri),
          ),
        ),
      )
    }

    const keyset = new TimeCidKeyset(ref('post.sortAt'), ref('post.cid'))
    assertValidSince(keyset, since)
    builder = paginate(builder, {
      limit,
      cursor,
      since,
      keyset,
      tryIndex: true,
    })
    const page = keyset.page(await builder.execute(), limit)
    const firstItem = page.items[0]

    return {
      items: page.items.map((item) => ({ uri: item.uri, cid: item.cid })),
      cursor: page.cursor ?? exhaustedCursor(since),
      startCursor: firstItem ? keyset.packFromResult(firstItem) : undefined,
    }
  },
})

/**
 * A `since`-bounded request never reports exhaustion with an empty cursor: it
 * echoes `since`, a position the client can keep paginating below.
 */
const exhaustedCursor = (since: string) => since || undefined

/**
 * Rejects a `since` the keyset cannot unpack. Left to `paginate` it would raise
 * an xrpc error, which a Connect handler reports as an internal error.
 */
const assertValidSince = (keyset: TimeCidKeyset, since: string) => {
  if (!since) return
  try {
    keyset.unpack(since)
  } catch {
    throw new ConnectError('Malformed since cursor', Code.InvalidArgument)
  }
}

// @NOTE does not support additional fields in the protos specific to author feeds
// and timelines. at the time of writing, hydration/view implementations do not rely on them.
const feedItemFromRow = (row: { postUri: string; uri: string }) => {
  return {
    uri: row.postUri,
    repost: row.uri === row.postUri ? undefined : row.uri,
  }
}
