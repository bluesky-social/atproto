import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { mapDefined } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.mod.getLabelers({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const { labelers } = params
      const viewer = auth.credentials.iss

      const hydration = await ctx.hydrator.hydrateLabelers(labelers, viewer)

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
