import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.moderation.getService({
    auth: ctx.authVerifier.standardOptional,
    handler: async ({ params, auth, req }) => {
      const { did } = params
      const viewer = auth.credentials.iss
      const labelers = ctx.reqLabelers(req)

      const hydration = await ctx.hydrator.hydrateModServices([did], {
        viewer,
        labelers,
      })
      const view = ctx.views.modServiceDetailed(did, hydration)
      if (!view) {
        throw new InvalidRequestError('could not find moderation service')
      }

      return {
        encoding: 'application/json',
        body: view,
      }
    },
  })
}
