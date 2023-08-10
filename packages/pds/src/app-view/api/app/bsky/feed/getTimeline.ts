import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { filterMutesAndBlocks } from './getFeed'
import { isView } from '../../../../../lexicon/types/app/bsky/embed/record'
import { PostTypeSet } from '../util/postTypeSet'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      const { algorithm, excludePostTypes, limit, cursor } = params
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
            { limit, excludePostTypes, cursor },
            await ctx.serviceAuthHeaders(requester),
          )
        const filtered = await filterMutesAndBlocks(
          ctx,
          res.data,
          limit,
          requester,
        )
        let hydrated = await ctx.services.appView
          .feed(ctx.db)
          .hydrateFeed(filtered.feedItems, requester)
        const excludePostTypeSet = new PostTypeSet(excludePostTypes)
        if (excludePostTypeSet.hasQuote()) {
          hydrated = hydrated.filter((post) => !isView(post.post.embed))
        }
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

      const accountService = ctx.services.account(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)
      const graphService = ctx.services.appView.graph(ctx.db)
      const excludePostTypeSet = new PostTypeSet(excludePostTypes)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
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

      // if replies are off
      if (excludePostTypeSet.hasReply()) {
        feedItemsQb = feedItemsQb.where('post.replyRoot', 'is', null)
      }

      // if reposts are off
      if (excludePostTypeSet.hasRepost()) {
        feedItemsQb = feedItemsQb.where('feed_item.type', '!=', 'repost')
      }

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
        tryIndex: true,
      })

      const feedItems: FeedRow[] = await feedItemsQb.execute()
      let feed = await feedService.hydrateFeed(feedItems, requester)

      if (excludePostTypeSet.hasQuote()) {
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
