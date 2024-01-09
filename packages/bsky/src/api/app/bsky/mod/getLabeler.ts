import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.mod.getLabeler({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth }) => {
      const { labeler } = params
      const viewer = auth.credentials.iss

      const hydration = await ctx.hydrator.hydrateLabelers([labeler], viewer)
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
