import { mapDefined } from '@atproto/common'
import type { AtUriString } from '@atproto/syntax'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { parseString } from '../../../../hydration/util.js'
import { app } from '../../../../lexicons/index.js'
import { fillPage, resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.feed.getSuggestedFeeds, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ auth, params, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({ labelers, viewer })

      const result = await fillPage({
        cursor: params.cursor,
        limit: params.limit,
        fetch: async ({ cursor, limit }) => {
          // @NOTE no need to coordinate the cursor for appview swap, as v1 doesn't use the cursor
          const suggestedRes = await ctx.dataplane.getSuggestedFeeds({
            actorDid: viewer ?? undefined,
            cursor,
            limit,
          })
          const uris = suggestedRes.uris as AtUriString[]
          const hydration = await ctx.hydrator.hydrateFeedGens(uris, hydrateCtx)
          return {
            feeds: mapDefined(uris, (uri) =>
              ctx.views.feedGenerator(uri, hydration),
            ),
            cursor: parseString(suggestedRes.cursor),
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
