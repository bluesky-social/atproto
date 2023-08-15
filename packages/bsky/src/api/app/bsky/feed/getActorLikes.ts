import { Server } from '../../../../lexicon'
import { FeedKeyset } from '../util/feed'
import { paginate } from '../../../../db/pagination'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { setRepoRev } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getActorLikes({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth, res }) => {
      const { actor, limit, cursor } = params
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

      const actorService = ctx.services.actor(ctx.db)
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

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .innerJoin('like', 'like.subject', 'feed_item.uri')
        .where('like.creator', '=', did)

      if (viewer !== null) {
        feedItemsQb = feedItemsQb
          .where((qb) =>
            qb.where((qb) =>
              graphService.whereNotMuted(qb, viewer, [ref('post.creator')]),
            ),
          )
          // TODO do we want this? was missing here
          .whereNotExists(graphService.blockQb(viewer, [ref('post.creator')]))
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
