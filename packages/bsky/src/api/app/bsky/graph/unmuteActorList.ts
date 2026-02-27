import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.unmuteActorList, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.iss
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.REMOVE,
        actorDid: requester,
        subject: list,
      })
    },
  })
}
