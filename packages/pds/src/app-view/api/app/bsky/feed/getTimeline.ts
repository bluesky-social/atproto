import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { filterMutesAndBlocks } from './getFeed'
import { isView } from '../../../../../lexicon/types/app/bsky/embed/record'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      const { algorithm, limit, cursor } = params
      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      if (ctx.canProxyRead(req)) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getTimeline(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      if (ctx.cfg.bskyAppViewEndpoint) {
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

      const db = ctx.db.db
      const { ref } = db.dynamic
      const {
        minReplyLikeCount,
        includeQuotePosts,
        includeReplies,
        includeReposts,
      } = params

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
      const sortFrom = keyset.unpack(cursor)?.primary

      let feedItemsQb = feedService.selectFeedItemQb()

      // if replies are off
      if (!includeReplies) {
        feedItemsQb = feedItemsQb.where('post.replyRoot', 'is', null)
      }

      // if reposts are off
      if (!includeReposts) {
        feedItemsQb = feedItemsQb.where('feed_item.type', '!=', 'repost')
      }

      feedItemsQb = feedItemsQb
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

      const feedItems: FeedRow[] = await feedItemsQb.execute()
      let feed = await feedService.hydrateFeed(feedItems, requester)

      // includeReplies
      // apply minReplyLikeCount
      if (includeReplies && minReplyLikeCount > 0) {
        feed = feed.filter((post) => {
          let showPost = true
          if (post.reply && post.post.likeCount !== undefined) {
            showPost = post.post.likeCount >= minReplyLikeCount
          }
          return showPost
        })
      }
      /* else if includeReplies is false, we've already filtered out replies */

      // includeQuotePosts
      if (!includeQuotePosts) {
        feed = feed.filter((post) => !isView(post.post.embed))
      }

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
