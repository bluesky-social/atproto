import { SpaceUri, toDatetimeString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

// Registrations are valid for 24h; the caller renews before expiry. May be
// longer than the space-credential window the request was authed with.
const REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.registerNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input, auth }) => {
      const { space, endpoint } = input.body

      if (auth.credentials.space !== space) {
        throw new InvalidRequestError('Credential space mismatch')
      }

      const authorityDid = new SpaceUri(space).spaceDid

      // Key the registration by the requesting service. The space credential
      // carries the attested client_id when present; fall back to the endpoint
      // as a stable key otherwise.
      const serviceKey = auth.credentials.clientId ?? endpoint

      const spaceRow = await ctx.actorStore.read(authorityDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow || spaceRow.deletedAt || !spaceRow.isOwner) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }

      await ctx.actorStore.transact(authorityDid, async (actorTxn) => {
        await actorTxn.space.recordCredentialRecipient(
          space,
          serviceKey,
          endpoint,
        )
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
