import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.muteActor, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.iss
      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: requester,
        subject: did,
      })
    },
  })
}
