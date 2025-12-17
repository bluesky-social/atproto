import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.reserveSigningKey, {
    handler: async ({ input }) => {
      const signingKey = await ctx.actorStore.reserveKeypair(input.body.did)
      return {
        encoding: 'application/json' as const,
        body: { signingKey },
      }
    },
  })
}
