import { mapDefined } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.labeler.getServices({
    auth: ctx.authVerifier.standardOptional,
    handler: ctx.createHandler(async (ctx) => {
      const { dids, detailed } = ctx.params

      const hydration = await ctx.hydrator.hydrateLabelers(dids, ctx)

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
        body: { views },
      }
    }),
  })
}
