import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteThread({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { root } = input.body
      const requester = auth.credentials.iss
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: requester,
        subject: root,
      })
    },
  })
}
