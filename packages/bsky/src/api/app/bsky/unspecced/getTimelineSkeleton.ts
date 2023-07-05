import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedKeyset, getFeedDateThreshold } from '../util/feed'
import { paginate } from '../../../../db/pagination'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.db
      const { ref } = db.dynamic

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
      const feed = feedItems.map((item) => ({
        post: item.postUri,
        reason:
          item.uri === item.postUri
            ? undefined
            : {
                $type: 'app.bsky.feed.defs#skeletonReasonRepost',
                repost: item.uri,
              },
      }))
      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(feedItems),
          feed,
        },
      }
    },
  })
}
