import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getSuggestedFeeds({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss

      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const actorService = ctx.services.actor(db)
      const feedsRes = await db.db
        .selectFrom('suggested_feed')
        .orderBy('suggested_feed.order', 'asc')
        .selectAll()
        .execute()
      const genInfos = await feedService.getFeedGeneratorInfos(
        feedsRes.map((r) => r.uri),
        viewer,
      )
      const genList = feedsRes.map((r) => genInfos[r.uri]).filter(Boolean)
      const creators = genList.map((gen) => gen.creator)
      const profiles = await actorService.views.profilesBasic(creators, viewer)

      const feedViews = mapDefined(genList, (gen) =>
        feedService.views.formatFeedGeneratorView(gen, profiles),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
        },
      }
    },
  })
}
