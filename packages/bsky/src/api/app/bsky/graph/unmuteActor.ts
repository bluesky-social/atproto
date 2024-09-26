import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.unmuteActor({
    auth: ctx.authVerifier.standard,
    handler: ctx.createHandler(async (ctx, { input }) => {
      const { actor } = input.body

      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')

      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.REMOVE,
        actorDid: ctx.viewer ?? undefined,
        subject: did,
      })
    }),
  })
}
