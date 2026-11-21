import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  // Authed like the other internal.pds endpoints. Unlike
  // com.atproto.server.reserveSigningKey it is never public: each call writes
  // a key to disk.
  server.add(internal.pds.reserveKemKey, {
    auth: ctx.authVerifier.adminTokenOrEntrywayService,
    handler: async ({ input }) => {
      const kemKey = await ctx.actorStore.reserveKemKeypair(input.body.did)
      return {
        encoding: 'application/json' as const,
        body: { kemKey },
      }
    },
  })
}
