import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  // Authed like com.atproto.server.reserveSigningKey behind an entryway, the
  // only place this is registered
  server.add(internal.pds.reserveKemKey, {
    auth: ctx.authVerifier.entrywayServiceOptional,
    handler: async ({ input }) => {
      const kemKey = await ctx.actorStore.reserveKemKeypair(input.body.did)
      return {
        encoding: 'application/json' as const,
        body: { kemKey },
      }
    },
  })
}
