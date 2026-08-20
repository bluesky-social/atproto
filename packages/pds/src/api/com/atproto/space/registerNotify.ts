import { DAY } from '@atproto/common'
import { toDatetimeString } from '@atproto/syntax'
import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertCredentialSpace,
  assertSpaceHost,
  resolveServiceEndpoint,
} from './util.js'

// How long a registration lasts before the service has to renew it.
const REGISTRATION_TTL_MS = DAY

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.registerNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input, auth }) => {
      const { space, service } = input.body

      assertCredentialSpace(auth.credentials, space)

      const spaceDid = await assertSpaceHost(ctx, space)

      const endpoint = await resolveServiceEndpoint(ctx.idResolver, service)
      if (!endpoint) {
        throw new InvalidRequestError(
          `Could not resolve a service endpoint for ${service}`,
          'ServiceNotResolvable',
        )
      }

      // Registrations are the authority's to hold, so this host must govern the space.
      await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getActiveSpaceConfig(space),
      )

      const expiresAt = toDatetimeString(
        new Date(Date.now() + REGISTRATION_TTL_MS),
      )

      await ctx.actorStore.transact(spaceDid, (actorTxn) =>
        actorTxn.space.recordCredentialRecipient({
          space,
          serviceDid: service,
          serviceEndpoint: endpoint,
          expiresAt,
        }),
      )

      return {
        encoding: 'application/json' as const,
        body: { expiresAt },
      }
    },
  })
}
