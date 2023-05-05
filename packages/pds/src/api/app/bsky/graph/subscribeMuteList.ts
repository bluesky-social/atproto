import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.subscribeMuteList({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.did

      await ctx.services.account(ctx.db).subscribeMuteList({
        list,
        mutedByDid: requester,
      })
    },
  })
}
