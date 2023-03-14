import { Server } from '../../../../../lexicon'
import { FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.appView.feed(ctx.db)

      const userLookupCol = actor.startsWith('did:')
        ? 'did_handle.did'
        : 'did_handle.handle'
      const userQb = db
        .selectFrom('did_handle')
        .selectAll()
        .where(userLookupCol, '=', actor)
      const mutedQb = db
        .selectFrom('mute')
        .select('did')
        .where('mutedByDid', '=', requester)

      const postsQb = feedService
        .selectPostQb()
        .whereExists(
          userQb.whereRef('did_handle.did', '=', ref('post.creator')),
        )

      const repostsQb = feedService
        .selectRepostQb()
        .whereExists(
          userQb.whereRef('did_handle.did', '=', ref('repost.creator')),
        )
        .whereNotExists(mutedQb.whereRef('did', '=', ref('post.creator'))) // Hide reposts of muted content

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
