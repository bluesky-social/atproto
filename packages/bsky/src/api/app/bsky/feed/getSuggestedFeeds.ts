import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getSuggestedFeeds({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.did

      const db = ctx.db.getReplica()
      const feedService = ctx.services.feed(db)
      const feedsRes = await db.db
        .selectFrom('suggested_feed')
        .orderBy('suggested_feed.order', 'asc')
        .selectAll()
        .execute()

      const genInfos = await feedService.getFeedGeneratorInfos(
        feedsRes.map((r) => r.uri),
        viewer,
      )
      const genList = Object.values(genInfos)

      const creators = genList.map((gen) => gen.creator)
      const profiles = await feedService.getActorInfos(creators, viewer)

      const feedViews = genList.map((gen) =>
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
