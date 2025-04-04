import { mapDefined } from '@atproto/common'
import { AppContext } from '../../../../context'
import { parseString } from '../../../../hydration/util'
import { Server } from '../../../../lexicon'
import { clearlyBadCursor, resHeaders } from '../../../util'

// THIS IS A TEMPORARY UNSPECCED ROUTE
// @TODO currently mirrors getSuggestedFeeds and ignores the "query" param.
// In the future may take into consideration popularity via likes w/ its own dataplane endpoint.
export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.getPopularFeedGenerators({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ viewer, labelers })

      if (clearlyBadCursor(params.cursor)) {
        return {
          encoding: 'application/json',
          body: { feeds: [] },
        }
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
          actorDid: viewer ?? undefined,
          limit: params.limit,
          cursor: params.cursor,
        })
        uris = res.uris
        cursor = parseString(res.cursor)
      }

      const hydration = await ctx.hydrator.hydrateFeedGens(uris, hydrateCtx)
      const feedViews = mapDefined(uris, (uri) =>
        ctx.views.feedGenerator(uri, hydration),
      )

      return {
        encoding: 'application/json',
        body: {
          feeds: feedViews,
          cursor,
        },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
