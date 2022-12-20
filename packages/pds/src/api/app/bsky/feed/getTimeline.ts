import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, before } = params
      const db = ctx.db.db
      const { ref } = db.dynamic
      const requester = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const feedService = ctx.services.feed(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const postsQb = feedService
        .selectPostQb()
        .where('creator', '=', requester)
        .orWhere('creator', 'in', followingIdsSubquery)

      const repostsQb = feedService
        .selectRepostQb()
        .where('repost.creator', '=', requester)
        .orWhere('repost.creator', 'in', followingIdsSubquery)

      const trendsQb = feedService
        .selectTrendQb()
        .where('trend.creator', '=', requester)
        .orWhere('trend.creator', 'in', followingIdsSubquery)

      const keyset = new FeedKeyset(ref('cursor'), ref('postCid'))
      let feedItemsQb = db
        .selectFrom(postsQb.union(repostsQb).union(trendsQb).as('feed_items'))
        .selectAll()
      feedItemsQb = paginate(feedItemsQb, {
        limit,
        before,
        keyset,
      })
      const feedItems: FeedRow[] = await feedItemsQb.execute()
      const feed = await composeFeed(feedService, feedItems, requester)

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
