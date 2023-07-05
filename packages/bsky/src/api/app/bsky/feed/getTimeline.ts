import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../../services/types'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, cursor } = params
      const viewer = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const feedService = ctx.services.feed(ctx.db)
      const agg = await ctx.db.db
        .selectFrom('profile_agg')
        .select(['followsCount'])
        .where('did', '=', viewer)
        .executeTakeFirst()
      const followsCount = agg?.followsCount ?? 0
      const feedItems: FeedRow[] =
        followsCount > 5
          ? await getFeedItemsHighFollow(ctx, { viewer, cursor, limit })
          : await getFeedItemsLowFollow(ctx, { viewer, cursor, limit })

      const keyset = new FeedKeyset(sql``, sql``)
      const feed = await feedService.hydrateFeed(feedItems, viewer)

      return {
        encoding: 'application/json',
        body: {
          feed,
          cursor: keyset.packFromResult(feedItems),
        },
      }
    },
  })
}

async function getFeedItemsHighFollow(
  ctx: AppContext,
  opts: { viewer: string; cursor?: string; limit: number },
): Promise<FeedRow[]> {
  const { viewer, cursor, limit } = opts
  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.feed(ctx.db)
  const graphService = ctx.services.graph(ctx.db)

  const followingIdsSubquery = ctx.db.db
    .selectFrom('follow')
    .select('follow.subjectDid')
    .where('follow.creator', '=', viewer)

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let feedItemsQb = feedService
    .selectFeedItemQb()
    .where((qb) =>
      qb
        .where('originatorDid', '=', viewer)
        .orWhere('originatorDid', 'in', followingIdsSubquery),
    )
    .where((qb) =>
      // Hide posts and reposts of or by muted actors
      graphService.whereNotMuted(qb, viewer, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
    )
    .whereNotExists(
      graphService.blockQb(viewer, [ref('post.creator'), ref('originatorDid')]),
    )
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))

  feedItemsQb = paginate(feedItemsQb, {
    limit,
    cursor,
    keyset,
    tryIndex: true,
  })

  return await feedItemsQb.execute()
}

async function getFeedItemsLowFollow(
  ctx: AppContext,
  opts: { viewer: string; cursor?: string; limit: number },
): Promise<FeedRow[]> {
  const { viewer, cursor, limit } = opts
  const { ref } = ctx.db.db.dynamic
  const feedService = ctx.services.feed(ctx.db)
  const graphService = ctx.services.graph(ctx.db)

  const subKeyset = new FeedKeyset(
    ref('feed_item.sortAt'),
    ref('feed_item.cid'),
  )
  const mainKeyset = new FeedKeyset(ref('sortAt'), ref('cid'))
  const sortFrom = mainKeyset.unpack(cursor)?.primary

  // my feed items
  let myFeedItemsQb = feedService
    .selectFeedItemQb()
    .where('originatorDid', '=', viewer)
    .where((qb) =>
      // Hide posts and reposts of or by muted actors
      graphService.whereNotMuted(qb, viewer, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
    )
    .whereNotExists(
      graphService.blockQb(viewer, [ref('post.creator'), ref('originatorDid')]),
    )

  myFeedItemsQb = paginate(myFeedItemsQb, {
    limit,
    cursor,
    keyset: subKeyset,
    tryIndex: true,
  })

  // follows feed items
  const followingIdsSubquery = ctx.db.db
    .selectFrom('follow')
    .select('follow.subjectDid')
    .where('follow.creator', '=', viewer)

  let followFeedItemsQb = feedService
    .selectFeedItemQb()
    .where('originatorDid', 'in', followingIdsSubquery)
    .where((qb) =>
      // Hide posts and reposts of or by muted actors
      graphService.whereNotMuted(qb, viewer, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
    )
    .whereNotExists(
      graphService.blockQb(viewer, [ref('post.creator'), ref('originatorDid')]),
    )
    .where('feed_item.sortAt', '>', getFeedDateThreshold(sortFrom))

  followFeedItemsQb = paginate(followFeedItemsQb, {
    limit,
    cursor,
    keyset: subKeyset,
    tryIndex: true,
  })

  // combine my and follow feed items
  const emptyQb = feedService.selectFeedItemQb().where(sql`1 = 0`)

  let allFeedItemsQb = ctx.db.db
    .selectFrom(
      emptyQb
        .unionAll(sql`${myFeedItemsQb}`)
        .unionAll(sql`${followFeedItemsQb}`)
        .as('final_items'),
    )
    .selectAll()
  allFeedItemsQb = paginate(allFeedItemsQb, {
    limit,
    cursor,
    keyset: mainKeyset,
    tryIndex: true,
  })

  return await allFeedItemsQb.execute()
}
