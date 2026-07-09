import { mapDefined } from '@atproto/common'
import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { resHeaders } from '../../../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.labeler.getServices, {
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { dids, detailed } = params
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)
      const hydrateCtx = await ctx.hydrator.createContext({
        viewer,
        labelers,
      })
      const hydration = await ctx.hydrator.hydrateLabelers(dids, hydrateCtx)

      const views = mapDefined(dids, (did) => {
        if (detailed) {
          const view = ctx.views.labelerDetailed(did, hydration)
          if (!view) return
          return app.bsky.labeler.defs.labelerViewDetailed.$build(view)
        } else {
          const view = ctx.views.labeler(did, hydration)
          if (!view) return
          return app.bsky.labeler.defs.labelerView.$build(view)
        }
      })

      return {
        encoding: 'application/json',
        body: {
          views,
        },
        headers: resHeaders({ labelers: hydrateCtx.labelers }),
      }
    },
  })
}
