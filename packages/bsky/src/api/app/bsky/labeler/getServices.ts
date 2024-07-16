import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'
import { resHeaders } from '../../../util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.labeler.getServices({
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
          return {
            $type: 'app.bsky.labeler.defs#labelerViewDetailed',
            ...view,
          }
        } else {
          const view = ctx.views.labeler(did, hydration)
          if (!view) return
          return {
            $type: 'app.bsky.labeler.defs#labelerView',
            ...view,
          }
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
