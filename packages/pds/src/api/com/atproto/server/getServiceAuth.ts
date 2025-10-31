import { HOUR, MINUTE } from '@atproto/common'
import { InvalidRequestError, createServiceJwt } from '@atproto/xrpc-server'
import {
  AuthScope,
  isAccessPrivileged,
  isTakendown,
} from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { ids } from '../../../../lexicon/lexicons'
import { PRIVILEGED_METHODS, PROTECTED_METHODS } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getServiceAuth({
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.Takendown],
      authorize: (permissions, ctx) => {
        const { aud, lxm = '*' } = ctx.params
        permissions.assertRpc({ aud, lxm })
      },
    }),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did

      // @NOTE "exp" is expressed in seconds since epoch, not milliseconds
      const { aud, exp, lxm = null } = params

      // Takendown accounts should not be able to generate service auth tokens except for methods necessary for account migration
      if (auth.credentials.type === 'access') {
        // @NOTE We should probably use "ForbiddenError" here. Using
        // "InvalidRequestError" for legacy reasons.
        if (
          isTakendown(auth.credentials.scope) &&
          lxm !== ids.ComAtprotoServerCreateAccount
        ) {
          throw new InvalidRequestError('Bad token scope', 'InvalidToken')
        }

        // @NOTE "oauth" based credentials already checked through permission
        // set in "authorize" method above.
        if (
          lxm != null &&
          PRIVILEGED_METHODS.has(lxm) &&
          !isAccessPrivileged(auth.credentials.scope)
        ) {
          throw new InvalidRequestError(
            `insufficient access to request a service auth token for the following method: ${lxm}`,
          )
        }
      }

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

      if (lxm && PROTECTED_METHODS.has(lxm)) {
        throw new InvalidRequestError(
          `cannot request a service auth token for the following protected method: ${lxm}`,
        )
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
