import { Server } from '../../../../../lexicon'
import AppContext from '../../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.did

      if (ctx.canProxyWrite()) {
        await ctx.appviewAgent.api.app.bsky.graph.unmuteActorList(input.body, {
          ...(await ctx.serviceAuthHeaders(requester)),
          encoding: 'application/json',
        })
      }

      await ctx.services.account(ctx.db).unmuteActorList({
        list,
        mutedByDid: requester,
      })
    },
  })
}
