import { InvalidRequestError } from '@atproto/xrpc-server'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { TimeCidKeyset, paginate } from '../../../../db/pagination'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getActorFeeds({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const { actor, limit, cursor } = params
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const actorService = ctx.services.actor(db)
      const feedService = ctx.services.feed(db)

      const creatorRes = await actorService.getActor(actor)
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      const { ref } = db.db.dynamic
      let feedsQb = feedService
        .selectFeedGeneratorQb(viewer)
        .where('feed_generator.creator', '=', creatorRes.did)

      const keyset = new TimeCidKeyset(
        ref('feed_generator.createdAt'),
        ref('feed_generator.cid'),
      )
      feedsQb = paginate(feedsQb, {
        limit,
        cursor,
        keyset,
      })

      const [feedsRes, profiles] = await Promise.all([
        feedsQb.execute(),
        actorService.views.profiles([creatorRes], viewer),
      ])
      if (!profiles[creatorRes.did]) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      const feeds = mapDefined(feedsRes, (row) => {
        const feed = {
          ...row,
          viewer: viewer ? { like: row.viewerLike } : undefined,
        }
        return feedService.views.formatFeedGeneratorView(feed, profiles)
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: keyset.packFromResult(feedsRes),
          feeds,
        },
      }
    },
  })
}
