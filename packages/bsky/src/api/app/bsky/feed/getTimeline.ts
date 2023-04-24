import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { authVerifier } from '../../../auth'

// @TODO getTimeline() will be replaced by composeTimeline() in the app-view
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: authVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, cursor } = params
      const db = ctx.db.db
      const { ref } = db.dynamic
      const requester = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const feedService = ctx.services.feed(ctx.db)
      const labelService = ctx.services.label(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      // @NOTE mutes applied on pds
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where((qb) =>
          qb
            .where('originatorDid', '=', requester)
            .orWhere('originatorDid', 'in', followingIdsSubquery),
        )

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
      })
      const feedItems = await feedItemsQb.execute()
      const feed = await composeFeed(
        feedService,
        labelService,
        feedItems,
        requester,
      )

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
