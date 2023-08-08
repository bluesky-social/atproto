import { Server } from '../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { actor, limit, cursor, filter } = params
      const viewer = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic

      // first verify there is not a block between requester & subject
      if (viewer !== null) {
        const blocks = await ctx.services.graph(ctx.db).getBlocks(viewer, actor)
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
      }

      const feedService = ctx.services.feed(ctx.db)
      const graphService = ctx.services.graph(ctx.db)

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

      // defaults to posts, reposts, and replies
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', did)

      if (filter === 'posts_with_media') {
        // only posts with media
        feedItemsQb = feedItemsQb.whereExists((qb) =>
          qb
            .selectFrom('post_embed_image')
            .where('post_embed_image.postUri', '=', 'feed_item.postUri'),
        )
      } else if (filter === 'posts_no_replies') {
        // only posts, no replies
        feedItemsQb = feedItemsQb.where('post.replyParent', 'is', null)
      }

      if (viewer !== null) {
        feedItemsQb = feedItemsQb.where((qb) =>
          // Hide reposts of muted content
          qb
            .where('type', '=', 'post')
            .orWhere((qb) =>
              graphService.whereNotMuted(qb, viewer, [ref('post.creator')]),
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
