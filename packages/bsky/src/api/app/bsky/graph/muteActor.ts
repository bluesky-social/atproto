import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { MuteOperation_Type } from '../../../../proto/bsync_pb.js'

// The validation gate for mute kinds: everything downstream (bsync, the
// dataplane) passes kind values through without validating them.
const knownMuteKinds = new Set(['reposts', 'quoteposts'])

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.graph.muteActor, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const { actor, kinds = [] } = input.body
      const requester = auth.credentials.iss
      for (const kind of kinds) {
        if (!knownMuteKinds.has(kind)) {
          throw new InvalidRequestError(`Unsupported mute kind: ${kind}`)
        }
      }
      const [did] = await ctx.hydrator.actor.getDids([actor])
      if (!did) throw new InvalidRequestError('Actor not found')
      if (requester === did) {
        throw new InvalidRequestError('Actor cannot mute themselves')
      }
      await ctx.bsyncClient.addMuteOperation({
        type: MuteOperation_Type.ADD,
        actorDid: requester,
        subject: did,
        kinds,
      })
    },
  })
}
