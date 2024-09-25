import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { clearlyBadCursor } from '../../../util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
// @TODO currently mirrors getSuggestedFeeds and ignores the "query" param.
// In the future may take into consideration popularity via likes w/ its own dataplane endpoint.
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createHandler(async (ctx, params) => {
      if (clearlyBadCursor(params.cursor)) {
        return { feeds: [] }
      }

      let uris: string[]
      let cursor: string | undefined

      const query = params.query?.trim() ?? ''
      if (query) {
        const res = await ctx.dataplane.searchFeedGenerators({
          query,
          limit: params.limit,
        })
        uris = res.uris
      } else {
        const res = await ctx.dataplane.getSuggestedFeeds({
          actorDid: ctx.hydrateCtx.viewer ?? undefined,
          limit: params.limit,
          cursor: params.cursor,
        })
        uris = res.uris
        cursor = parseString(res.cursor)
      }

      const hydration = await ctx.hydrator.hydrateFeedGens(uris, ctx.hydrateCtx)
      const feedViews = mapDefined(uris, (uri) =>
        ctx.views.feedGenerator(uri, hydration),
      )

      return {
        feeds: feedViews,
        cursor,
      }
    }),
  })
}
