import { createServiceJwt } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/oauth-provider'
import { HOUR, MINUTE } from '@atproto/common'
import { PRIVILEGED_METHODS } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const { aud, scope } = params
      const exp = params.exp ? params.exp * 1000 : undefined
      if (exp) {
        const diff = exp - Date.now()
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
        } else if (!scope && diff > MINUTE) {
          throw new InvalidRequestError(
            'cannot request a scope-less token with an expiration more than a minute in the future',
            'BadExpiration',
          )
        }
      }
      if (
        !auth.credentials.isPrivileged &&
        scope &&
        PRIVILEGED_METHODS.includes(scope)
      ) {
        throw new InvalidRequestError(
          `cannot request a service auth token with the following scope with an app password: ${scope}`,
        )
      }
      const keypair = await ctx.actorStore.keypair(did)
      const token = await createServiceJwt({
        iss: did,
        aud,
        exp,
        scope: scope ?? null,
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
