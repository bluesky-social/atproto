import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { FeedKeyset } from '../util/feed'
import { FeedRow } from '../../../../services/types'
import { sql } from 'kysely'
import {
  getFeedItemsHighFollow,
  getFeedItemsLowFollow,
} from '../feed/getTimeline'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getTimelineSkeleton({
    auth: ctx.authVerifier,
    handler: async ({ auth, params }) => {
      const { limit, cursor } = params
      const viewer = auth.credentials.did

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
