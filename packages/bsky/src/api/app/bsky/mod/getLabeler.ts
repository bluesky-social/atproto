import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.mod.getLabeler({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { labeler } = params
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const hydration = await ctx.hydrator.hydrateLabelers([labeler], {
        viewer,
        labelers,
      })
      const view = ctx.views.labelerDetailed(labeler, hydration)
      if (!view) {
        throw new InvalidRequestError('could not find labeler')
      }

      return {
        encoding: 'application/json',
        body: {
          view,
        },
      }
    },
  })
}
