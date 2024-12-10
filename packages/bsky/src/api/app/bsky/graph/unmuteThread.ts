import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteThread({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { root } = input.body
      const requester = auth.credentials.iss
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.REMOVE,
        actorDid: requester,
        subject: root,
      })
    },
  })
}
