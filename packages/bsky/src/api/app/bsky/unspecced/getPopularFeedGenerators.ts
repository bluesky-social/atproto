import { mapDefined } from '@atproto/common'
import type { AtUriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { asInvalidRequest } from '../../../../data-plane/index.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import {
  clearlyBadCursor,
  fillPage,
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

      const isV2Override = resolveSearchV2Override(req, ctx.cfg)

      const query = params.query?.trim() ?? ''
      const result = await fillPage({
        cursor: params.cursor,
        limit: params.limit,
        fetch: async ({ cursor, limit }) => {
          let uris: AtUriString[]
          let nextCursor: string | undefined
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
                    cursor,
                    limit,
                  },
                })
                .catch(asInvalidRequest())
              uris = res.feedGenerators.map(({ uri }) => uri) as AtUriString[]
              nextCursor = parseString(res.pageInfo?.cursor)
            } else {
              const res = await ctx.dataplane
                .searchFeedGenerators({ query, limit })
                .catch(asInvalidRequest())
              uris = res.uris as AtUriString[]
            }
          } else {
            const res = await ctx.dataplane.getSuggestedFeeds({
              actorDid: viewer ?? undefined,
              cursor,
              limit,
            })
            uris = res.uris as AtUriString[]
            nextCursor = parseString(res.cursor)
          }

          const hydration = await ctx.hydrator.hydrateFeedGens(uris, hydrateCtx)
          return {
            feeds: mapDefined(uris, (uri) =>
              ctx.views.feedGenerator(uri, hydration),
            ),
            cursor: nextCursor,
          }
        },
        items: (r) => r.feeds,
      })

      return {
        encoding: 'application/json',
        body: result,
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
