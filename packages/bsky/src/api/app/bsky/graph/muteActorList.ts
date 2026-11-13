import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { MuteOperation_Type } from '../../../../proto/bsync_pb.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.muteActorList, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { list } = input.body
      const requester = auth.credentials.iss
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: requester,
        subject: list,
      })
    },
  })
}
