import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.reserveSigningKey({
    handler: async () => {
      const signingKey = await ctx.actorStore.reserveKeypair()
      return {
        encoding: 'application/json',
        body: {
          signingKey,
        },
      }
    },
  })
}
