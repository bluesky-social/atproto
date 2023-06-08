import { Server } from '../../../../lexicon'
import { FeedKeyset, composeFeed } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.feed(ctx.db)
      const graphService = ctx.services.graph(ctx.db)
      const labelService = ctx.services.label(ctx.db)

      let did = ''
      if (actor.startsWith('did:')) {
        did = actor
      } else {
        const actorRes = await db
          .selectFrom('actor')
          .select('did')
          .where('handle', '=', actor)
          .executeTakeFirst()
        if (actorRes) {
          did = actorRes?.did
        }
      }

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', did)

      if (requester !== null) {
        feedItemsQb = feedItemsQb.where((qb) =>
          // Hide reposts of muted content
          qb
            .where('type', '=', 'post')
            .orWhere((qb) =>
              graphService.whereNotMuted(qb, requester, [ref('post.creator')]),
            ),
        )
      }

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
