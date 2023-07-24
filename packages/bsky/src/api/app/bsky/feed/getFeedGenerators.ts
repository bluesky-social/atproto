import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const { feeds } = params
      const requester = auth.credentials.did

      const feedService = ctx.services.feed(ctx.db)

      const genInfos = await feedService.getFeedGeneratorInfos(feeds, requester)
      const genList = Object.values(genInfos)

      const creators = genList.map((gen) => gen.creator)
      const profiles = await feedService.getActorInfos(creators, requester)

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
