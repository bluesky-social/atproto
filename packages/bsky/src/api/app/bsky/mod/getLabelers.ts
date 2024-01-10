import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.mod.getLabelers({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const hydration = await ctx.hydrator.hydrateLabelers(params.labelers, {
        viewer,
        labelers,
      })

      const views = mapDefined(labelers, (uri) =>
        ctx.views.labeler(uri, hydration),
      )

      return {
        encoding: 'application/json',
        body: {
          labelers: views,
        },
      }
    },
  })
}
