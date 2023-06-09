import { Server } from '../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor } = params
      const viewer = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      const feedService = ctx.services.feed(ctx.db)

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

      // @NOTE mutes applied on pds
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', did)

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
      const feed = await feedService.hydrateFeed(feedItems, viewer)

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
