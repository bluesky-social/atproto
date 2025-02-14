import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MuteOperation_Type } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.authVerifier.standard,
    handler: ctx.createHandler(async (ctx) => {
      const { actor } = ctx.input.body

      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: ctx.viewer ?? undefined,
        subject: did,
      })
    }),
  })
}
