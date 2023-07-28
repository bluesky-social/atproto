import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { isView } from '../../../../lexicon/types/app/bsky/embed/record'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.authVerifier,
    handler: async ({ params, auth }) => {
      const {
        algorithm,
        minReplyLikeCount,
        showQuotePosts,
        showReplies,
        showReposts,
        limit,
        cursor,
      } = params
      const db = ctx.db.db
      const { ref } = db.dynamic
      const viewer = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const feedService = ctx.services.feed(ctx.db)
      const graphService = ctx.services.graph(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', viewer)

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )
      const sortFrom = keyset.unpack(cursor)?.primary

      let feedItemsQb = feedService.selectFeedItemQb()

      // if replies are off
      if (!showReplies) {
        feedItemsQb = feedItemsQb.where('post.replyRoot', 'is', null)
      }

      // if reposts are off
      if (!showReposts) {
        feedItemsQb = feedItemsQb.where('feed_item.type', '!=', 'repost')
      }

      feedItemsQb = feedItemsQb
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
          graphService.blockQb(viewer, [
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

      const feedItems = await feedItemsQb.execute()
      let feed = await feedService.hydrateFeed(feedItems, viewer)

      // showReplies
      // apply minReplyLikeCount
      if (showReplies && minReplyLikeCount > 0) {
        feed = feed.filter((post) => {
          let showPost = true
          if (post.reply && post.post.likeCount !== undefined) {
            showPost = post.post.likeCount >= minReplyLikeCount
          }
          return showPost
        })
      }
      /* else if showReplies is false, we've already filtered out replies */

      // showQuotePosts
      if (!showQuotePosts) {
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
