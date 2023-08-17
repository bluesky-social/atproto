import { Server } from '../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { setRepoRev } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth, res }) => {
      const { actor, limit, cursor, filter } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      // first verify there is not a block between requester & subject
      if (viewer !== null) {
        const blocks = await ctx.services.graph(db).getBlocks(viewer, actor)
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

      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const graphService = ctx.services.graph(db)

      // maybe resolve did first
      const actorRes = await actorService.getActor(actor)
      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      const actorDid = actorRes.did

      // defaults to posts, reposts, and replies
      let feedItemsQb = feedService
        .selectFeedItemQb()
        .where('originatorDid', '=', actorDid)

      if (filter === 'posts_with_media') {
        feedItemsQb = feedItemsQb
          // and only your own posts/reposts
          .where('post.creator', '=', actorDid)
          // only posts with media
          .whereExists((qb) =>
            qb
              .selectFrom('post_embed_image')
              .select('post_embed_image.postUri')
              .whereRef('post_embed_image.postUri', '=', 'feed_item.postUri'),
          )
      } else if (filter === 'posts_no_replies') {
        feedItemsQb = feedItemsQb
          .where((qb) => {
            return qb
              .where('post.replyParent', 'is', null)
              .orWhere('type', '=', 'repost')
          })
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

      const [feedItems, repoRev] = await Promise.all([
        feedItemsQb.execute(),
        actorService.getRepoRev(viewer),
      ])
      setRepoRev(res, repoRev)

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
