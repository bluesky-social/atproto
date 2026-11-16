import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../context.js'
import { internal } from '../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  // Authed like com.atproto.server.reserveSigningKey
  server.add(internal.pds.reserveKemKey, {
    auth: ctx.cfg.entryway
      ? ctx.authVerifier.entrywayServiceOptional
      : undefined,
    handler: async ({ input }) => {
      const kemKey = await ctx.actorStore.reserveKemKeypair(input.body.did)
      return {
        encoding: 'application/json' as const,
        body: { kemKey },
      }
    },
  })
}
