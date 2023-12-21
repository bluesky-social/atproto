import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getSuggestedFeeds({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.did

      const suggestedRes = await ctx.dataplane.getSuggestedFeeds({
        actorDid: viewer ?? undefined,
        limit: params.limit,
        cursor: params.cursor,
      })
      const uris = suggestedRes.uris
      const hydration = await ctx.hydrator.hydrateFeedGens(uris, viewer)
      const feedViews = mapDefined(uris, (uri) =>
        ctx.views.feedGenerator(uri, hydration),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
          cursor: parseString(suggestedRes.cursor),
        },
      }
    },
  })
}
