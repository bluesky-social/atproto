import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      await ctx.appViewAgent.api.app.bsky.graph.muteActor(input.body, {
        ...(await ctx.serviceAuthHeaders(requester)),
        encoding: 'application/json',
      })
    },
  })
}
