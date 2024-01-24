import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.graph.muteActor({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { actor } = input.body
      const viewer = auth.credentials.iss
      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')
      // @TODO switch to bsync
      await ctx.dataplane.createActorMute({ actorDid: viewer, subjectDid: did })
    },
  })
}
