import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActorList({
    auth: ctx.authVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.did

      await ctx.services.graph(ctx.db).unmuteActorList({
        list,
        mutedByDid: requester,
      })
    },
  })
}
