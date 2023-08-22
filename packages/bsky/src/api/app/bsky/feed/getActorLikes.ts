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
      const db = ctx.db.getReplica()
      const { ref } = db.db.dynamic

      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)
      const graphService = ctx.services.graph(db)

      // maybe resolve did first
      const actorRes = await actorService.getActor(actor)
      if (!actorRes) {
        throw new InvalidRequestError('Profile not found')
      }
      const actorDid = actorRes.did

      if (!viewer || viewer !== actorDid) {
        throw new InvalidRequestError('Profile not found')
      }

      let feedItemsQb = feedService
        .selectFeedItemQb()
        .innerJoin('like', 'like.subject', 'feed_item.uri')
        .where('like.creator', '=', actorDid)

      if (viewer !== null) {
        feedItemsQb = feedItemsQb
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
