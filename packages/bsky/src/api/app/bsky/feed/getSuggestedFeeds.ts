import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getSuggestedFeeds({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      // @NOTE no need to coordinate the cursor for appview swap, as v1 doesn't use the cursor
      const suggestedRes = await ctx.dataplane.getSuggestedFeeds({
        actorDid: viewer ?? undefined,
        limit: params.limit,
        cursor: params.cursor,
      })
      const uris = suggestedRes.uris
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })
      const hydration = await ctx.hydrator.hydrateFeedGens(uris, hydrateCtx)
      const feedViews = mapDefined(uris, (uri) =>
        ctx.views.feedGenerator(uri, hydration),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
          cursor: parseString(suggestedRes.cursor),
        },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
