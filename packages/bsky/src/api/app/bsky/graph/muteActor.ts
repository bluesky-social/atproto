import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { MuteOperation_Type } from '../../../../proto/bsync_pb.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.muteActor, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const requester = auth.credentials.iss
      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')
      if (requester === did) {
        throw new InvalidRequestError('Actor cannot mute themselves')
      }
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: requester,
        subject: did,
      })
    },
  })
}
