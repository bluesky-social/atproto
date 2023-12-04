import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.reserveSigningKey({
    handler: async () => {
      return {
        encoding: 'application/json',
        body: {
          signingKey: ctx.repoSigningKey.did(),
        },
      }
    },
  })
}
