import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      await ctx.appViewAgent.api.app.bsky.graph.unmuteActorList(input.body, {
        ...(await ctx.serviceAuthHeaders(requester)),
        encoding: 'application/json',
      })
    },
  })
}
