import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { countAll } from '../../../../db/util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      const db = ctx.db.db
      const { ref } = db.dynamic
      const feedService = ctx.services.feed(ctx.db)

      const mostPopularFeeds = await ctx.db.db
        .selectFrom('feed_generator')
        .select([
          'uri',
          ctx.db.db
            .selectFrom('like')
            .whereRef('like.subject', '=', ref('feed_generator.uri'))
            .select(countAll.as('count'))
            .as('likeCount'),
        ])
        .orderBy('likeCount', 'desc')
        .orderBy('cid', 'desc')
        .limit(50)
        .execute()

      const genViews = await feedService.getFeedGeneratorViews(
        mostPopularFeeds.map((feed) => feed.uri),
        requester,
      )

      const genList = Object.values(genViews)
      const creators = genList.map((gen) => gen.creator)
      const profiles = await feedService.getActorViews(creators, requester)

      const feedViews = genList.map((gen) =>
        feedService.views.formatFeedGeneratorView(gen, profiles),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews.sort((feedA, feedB) => {
            const likeA = feedA.likeCount ?? 0
            const likeB = feedB.likeCount ?? 0
            const likeDiff = likeB - likeA
            if (likeDiff !== 0) return likeDiff
            return feedB.cid.localeCompare(feedA.cid)
          }),
        },
      }
    },
  })
}
