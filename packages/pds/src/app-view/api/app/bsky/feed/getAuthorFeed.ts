import { Server } from '../../../../../lexicon'
import { FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../../db/pagination'
import AppContext from '../../../../../context'
import { FeedRow } from '../../../../services/feed'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      // first verify there is not a block between requester & subject
      const blocks = await ctx.services.appView
        .actor(ctx.db)
        .getBlocks(requester, actor)
      if (blocks.blocking) {
        throw new InvalidRequestError(
          `Requester has blocked actor: ${actor}`,
          'BlockedActor',
        )
      } else if (blocks.blockedBy) {
        throw new InvalidRequestError(
          `Requester is blocked by actor: $${actor}`,
          'BlockedByActor',
        )
      }

      const feedService = ctx.services.appView.feed(ctx.db)
      const labelService = ctx.services.appView.label(ctx.db)

      const userLookupCol = actor.startsWith('did:')
        ? 'did_handle.did'
        : 'did_handle.handle'
      const actorDidQb = db
        .selectFrom('did_handle')
        .select('did')
        .where(userLookupCol, '=', actor)
        .limit(1)
      const mutedDidsQb = db
        .selectFrom('mute')
        .select('did')
        .where('mutedByDid', '=', requester)

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', actorDidQb)
        .where((qb) => {
          // Hide reposts of muted content
          return qb
            .where('type', '!=', 'repost')
            .orWhere('post.creator', 'not in', mutedDidsQb)
        })

      const keyset = new FeedKeyset(
        ref('feed_item.sortAt'),
        ref('feed_item.cid'),
      )

      feedItemsQb = paginate(feedItemsQb, {
        limit,
        cursor,
        keyset,
      })

      const feedItems: FeedRow[] = await feedItemsQb.execute()
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
