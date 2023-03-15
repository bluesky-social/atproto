import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../../lexicon'
import { FeedAlgorithm, FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

// @TODO getTimeline() will be replaced by composeTimeline() in the app-view
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { algorithm, limit, cursor } = params
      const db = ctx.db.db
      const { ref } = db.dynamic
      const requester = auth.credentials.did

      if (algorithm && algorithm !== FeedAlgorithm.ReverseChronological) {
        throw new InvalidRequestError(`Unsupported algorithm: ${algorithm}`)
      }

      const feedService = ctx.services.appView.feed(ctx.db)

      const followingIdsSubquery = db
        .selectFrom('follow')
        .select('follow.subjectDid')
        .where('follow.creator', '=', requester)

      const mutedQb = db
        .selectFrom('mute')
        .select('did')
        .where('mutedByDid', '=', requester)

      const postsQb = feedService
        .selectPostQb()
        .where((qb) =>
          qb
            .where('creator', '=', requester)
            .orWhere('creator', 'in', followingIdsSubquery),
        )
        .whereNotExists(mutedQb.whereRef('did', '=', ref('post.creator'))) // Hide posts of muted actors

      const repostsQb = feedService
        .selectRepostQb()
        .where((qb) =>
          qb
            .where('repost.creator', '=', requester)
            .orWhere('repost.creator', 'in', followingIdsSubquery),
        )
        .whereNotExists(
          mutedQb
            .whereRef('did', '=', ref('post.creator')) // Hide reposts of or by muted actors
            .orWhereRef('did', '=', ref('repost.creator')),
        )

      const keyset = new FeedKeyset(ref('cursor'), ref('postCid'))
      let feedItemsQb = db
        .selectFrom(postsQb.unionAll(repostsQb).as('feed_items'))
        .selectAll()
      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
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
