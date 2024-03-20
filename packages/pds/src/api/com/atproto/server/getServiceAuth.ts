import { createServiceJwt } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.access,
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const keypair = await ctx.actorStore.keypair(did)
      const token = await createServiceJwt({
        iss: did,
        aud: params.aud,
        keypair,
      })
      return {
        encoding: 'application/json',
        body: {
          token,
        },
      }
    },
  })
}
