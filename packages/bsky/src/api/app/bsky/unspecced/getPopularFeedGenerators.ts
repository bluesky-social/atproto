import { mapDefined } from '@atproto/common'
import type { AtUriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { asInvalidRequest } from '../../../../data-plane/index.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  clearlyBadCursor,
  resHeaders,
  resolveSearchV2Override,
} from '../../../util.js'

// THIS IS A TEMPORARY UNSPECCED ROUTE
// @TODO currently mirrors getSuggestedFeeds and ignores the "query" param.
// In the future may take into consideration popularity via likes w/ its own dataplane endpoint.
export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.unspecced.getPopularFeedGenerators, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const features = ctx.featureGatesClient.scope(
        ctx.featureGatesClient.parseUserContextFromHandler({
          viewer,
          req,
        }),
      )
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
        features,
      })

      if (clearlyBadCursor(params.cursor)) {
        return {
          encoding: 'application/json',
          body: { feeds: [] },
        }
      }

      let uris: AtUriString[]
      let cursor: string | undefined

      const isV2Override = resolveSearchV2Override(req, ctx.cfg)

      const query = params.query?.trim() ?? ''
      if (query) {
        const useV2 =
          features.checkGate(features.Gate.SearchV2Enable) || isV2Override
        // Surface dataplane InvalidArgument errors as a 400 rather than a 500.
        if (useV2) {
          const res = await ctx.dataplane
            .searchFeedGeneratorsV2({
              params: {
                query,
                viewer: viewer ?? undefined,
                limit: params.limit,
              },
            })
            .catch(asInvalidRequest())
          uris = res.feedGenerators.map(({ uri }) => uri) as AtUriString[]
        } else {
          const res = await ctx.dataplane
            .searchFeedGenerators({
              query,
              limit: params.limit,
            })
            .catch(asInvalidRequest())
          uris = res.uris as AtUriString[]
        }
      } else {
        const res = await ctx.dataplane.getSuggestedFeeds({
          actorDid: viewer ?? undefined,
          limit: params.limit,
          cursor: params.cursor,
        })
        uris = res.uris as AtUriString[]
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
