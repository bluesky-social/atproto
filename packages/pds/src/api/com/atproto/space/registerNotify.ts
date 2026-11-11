import { DAY } from '@atproto/common'
import { isAtprotoDidRefAbsolute } from '@atproto/did'
import { toDatetimeString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertCredentialSpace,
  assertSpaceHost,
  resolveServiceEndpoint,
  toSpaceRef,
} from './util.js'

// How long a registration lasts before the service has to renew it.
const REGISTRATION_TTL_MS = DAY

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.registerNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input: { body }, auth }) => {
      const { space, service } = body
      const ref = toSpaceRef(space)

      assertCredentialSpace(auth.credentials, ref)

      if (!isAtprotoDidRefAbsolute(service)) {
        throw new InvalidRequestError(
          `service must be a did#serviceId reference, got: ${service}`,
        )
      }

      await assertSpaceHost(ctx, ref)

      const endpoint = await resolveServiceEndpoint(ctx.idResolver, service)
      if (!endpoint) {
        throw new InvalidRequestError(
          `Could not resolve a service endpoint for ${service}`,
          'ServiceNotResolvable',
        )
      }

      // Registrations are the authority's to hold, so this host must govern the space.
      await ctx.actorStore.read(ref.spaceDid, (store) =>
        store.space.getActiveSpacePolicy(space),
      )

      const expiresAt = toDatetimeString(Date.now() + REGISTRATION_TTL_MS)

      await ctx.actorStore.transact(ref.spaceDid, (actorTxn) =>
        actorTxn.space.recordCredentialRecipient({
          space,
          service,
          serviceEndpoint: endpoint,
          expiresAt,
        }),
      )

      return {
        encoding: 'application/json',
        body: { expiresAt },
      }
    },
  })
}
