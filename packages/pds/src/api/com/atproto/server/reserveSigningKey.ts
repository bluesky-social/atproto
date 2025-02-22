import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.reserveSigningKey({
    handler: async ({ input }) => {
      const signingKey = await ctx.actorStore.reserveKeypair(input.body.did)
      return {
        encoding: 'application/json',
        body: {
          signingKey,
        },
      }
    },
  })
}
