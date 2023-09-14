import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'
import { TimeCidKeyset, paginate } from '../../../../../db/pagination'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getActorFeeds({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      if (ctx.canProxyRead()) {
        const res = await ctx.appviewAgent.api.app.bsky.feed.getActorFeeds(
          params,
          await ctx.serviceAuthHeaders(requester),
        )
        return {
          encoding: 'application/json',
          body: res.data,
        }
      }

      const { actor, limit, cursor } = params

      const actorService = ctx.services.appView.actor(ctx.db)
      const feedService = ctx.services.appView.feed(ctx.db)

      const creatorRes = await actorService.getActor(actor)
      if (!creatorRes) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      const { ref } = ctx.db.db.dynamic
      let feedsQb = feedService
        .selectFeedGeneratorQb(requester)
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

      const [feedsRes, creatorProfile] = await Promise.all([
        feedsQb.execute(),
        actorService.views.profile(creatorRes, requester),
      ])
      if (!creatorProfile) {
        throw new InvalidRequestError(`Actor not found: ${actor}`)
      }

      const profiles = { [creatorProfile.did]: creatorProfile }

      const feeds = feedsRes.map((row) =>
        feedService.views.formatFeedGeneratorView(row, profiles),
      )

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
