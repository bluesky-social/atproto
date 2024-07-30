import { InvalidRequestError, createServiceJwt } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.accessPrivileged(),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const keypair = await ctx.actorStore.keypair(did)
      const exp = params.exp ? params.exp * 1000 : undefined
      if (exp) {
        const diff = exp - Date.now()
        if (diff < 0) {
          throw new InvalidRequestError(
            'expiration is in past',
            'BadExpiration',
          )
        } else if (diff > MINUTE) {
          throw new InvalidRequestError(
            'cannot request a token with an expiration more than an hour in the future',
            'BadExpiration',
          )
        }
      }

      const token = await createServiceJwt({
        iss: did,
        aud: params.aud,
        lxm: params.lxm ?? null,
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
