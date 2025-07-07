import { HOUR, MINUTE } from '@atproto/common'
import { InvalidRequestError, createServiceJwt } from '@atproto/xrpc-server'
import { ACCESS_STANDARD, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { PROTECTED_METHODS } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.authorization({
      scopes: [...ACCESS_STANDARD, AuthScope.Takendown],
      authorize: ({ permissions, params }) => permissions.assertRpc(params),
    }),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did

      // @NOTE "exp" is expressed in seconds since epoch, not milliseconds
      const { aud, exp, lxm = null } = params

      if (exp) {
        const diff = exp * 1000 - Date.now()
        if (diff < 0) {
          throw new InvalidRequestError(
            'expiration is in past',
            'BadExpiration',
          )
        } else if (diff > HOUR) {
          throw new InvalidRequestError(
            'cannot request a token with an expiration more than an hour in the future',
            'BadExpiration',
          )
        } else if (!lxm && diff > MINUTE) {
          throw new InvalidRequestError(
            'cannot request a method-less token with an expiration more than a minute in the future',
            'BadExpiration',
          )
        }
      }

      if (lxm) {
        if (PROTECTED_METHODS.has(lxm)) {
          throw new InvalidRequestError(
            `cannot request a service auth token for the following protected method: ${lxm}`,
          )
        }
      }

      const keypair = await ctx.actorStore.keypair(did)

      const token = await createServiceJwt({
        iss: did,
        aud,
        exp,
        lxm,
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
