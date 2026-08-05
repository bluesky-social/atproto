import { toDatetimeString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import {
  assertCredentialSpace,
  resolveServiceEndpoint,
  toSpaceRef,
} from './util.js'

// Registrations are valid for 24h; the caller renews before expiry. May be
// longer than the space-credential window the request was authed with.
const REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.registerNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input, auth }) => {
      const { space, service } = input.body

      assertCredentialSpace(auth.credentials, space)

      const { spaceDid } = toSpaceRef(space)

      const endpoint = await resolveServiceEndpoint(ctx.idResolver, service)
      if (!endpoint) {
        throw new InvalidRequestError(
          `Could not resolve a service endpoint for ${service}`,
          'ServiceNotResolvable',
        )
      }

      const spaceRow = await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow || spaceRow.deletedAt) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }

      await ctx.actorStore.transact(spaceDid, async (actorTxn) => {
        await actorTxn.space.recordCredentialRecipient(space, service, endpoint)
      })

      const expiresAt = toDatetimeString(
        new Date(Date.now() + REGISTRATION_TTL_MS),
      )
      return {
        encoding: 'application/json' as const,
        body: { expiresAt },
      }
    },
  })
}
