import { sql } from 'kysely'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { filterMutesAndBlocks } from './getFeed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      const { algorithm, limit, cursor } = params
      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      if (ctx.canProxy(req)) {
        const res =
          await ctx.appviewAgent.api.app.bsky.unspecced.getTimelineSkeleton(
            { limit, cursor },
            await ctx.serviceAuthHeaders(requester),
          )
        const filtered = await filterMutesAndBlocks(
          ctx,
          res.data,
          limit,
          requester,
        )
        const hydrated = await ctx.services.appView
          .feed(ctx.db)
          .hydrateFeed(filtered.feedItems, requester)
        return {
          encoding: 'application/json',
          body: {
            cursor: filtered.cursor,
            feed: hydrated,
          },
        }
      }

      const feedService = ctx.services.appView.feed(ctx.db)

      const agg = await ctx.db.db
        .selectFrom('profile_agg')
        .select(['followsCount'])
        .where('did', '=', requester)
        .executeTakeFirst()
      const followsCount = agg?.followsCount ?? 0

      const feedItems: FeedRow[] =
        followsCount > 5
          ? await getFeedItemsHighFollow(ctx, { requester, cursor, limit })
          : await getFeedItemsLowFollow(ctx, { requester, cursor, limit })

      const keyset = new FeedKeyset(sql``, sql``)
      const feed = await feedService.hydrateFeed(feedItems, requester)

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
  opts: { requester: string; cursor?: string; limit: number },
): Promise<FeedRow[]> {
  const { requester, cursor, limit } = opts
  const { ref } = ctx.db.db.dynamic
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const followingIdsSubquery = ctx.db.db
    .selectFrom('follow')
    .select('follow.subjectDid')
    .where('follow.creator', '=', requester)

  const keyset = new FeedKeyset(ref('feed_item.sortAt'), ref('feed_item.cid'))
  const sortFrom = keyset.unpack(cursor)?.primary

  let feedItemsQb = feedService
    .selectFeedItemQb()
    .where((qb) =>
      qb
        .where('originatorDid', '=', requester)
        .orWhere('originatorDid', 'in', followingIdsSubquery),
    )
    .where((qb) =>
      // Hide posts and reposts of or by muted actors
      accountService.whereNotMuted(qb, requester, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
    )
    .whereNotExists(
      graphService.blockQb(requester, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
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
  opts: { requester: string; cursor?: string; limit: number },
): Promise<FeedRow[]> {
  const { requester, cursor, limit } = opts
  const { ref } = ctx.db.db.dynamic
  const accountService = ctx.services.account(ctx.db)
  const feedService = ctx.services.appView.feed(ctx.db)
  const graphService = ctx.services.appView.graph(ctx.db)

  const subKeyset = new FeedKeyset(
    ref('feed_item.sortAt'),
    ref('feed_item.cid'),
  )
  const mainKeyset = new FeedKeyset(ref('sortAt'), ref('cid'))
  const sortFrom = mainKeyset.unpack(cursor)?.primary

  // my feed items
  let myFeedItemsQb = feedService
    .selectFeedItemQb()
    .where('originatorDid', '=', requester)

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
    .where('follow.creator', '=', requester)

  let followFeedItemsQb = feedService
    .selectFeedItemQb()
    .where('originatorDid', 'in', followingIdsSubquery)
    .where((qb) =>
      // Hide posts and reposts of or by muted actors
      accountService.whereNotMuted(qb, requester, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
    )
    .whereNotExists(
      graphService.blockQb(requester, [
        ref('post.creator'),
        ref('originatorDid'),
      ]),
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
