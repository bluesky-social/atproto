import { InvalidRequestError, createServiceJwt } from '@atproto/xrpc-server'
import { HOUR, MINUTE } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { PRIVILEGED_METHODS, PROTECTED_METHODS } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.accessStandard(),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const { aud, lxm = null } = params
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
        if (!auth.credentials.isPrivileged && PRIVILEGED_METHODS.has(lxm)) {
          throw new InvalidRequestError(
            `insufficient access to request a service auth token for the following method: ${lxm}`,
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
