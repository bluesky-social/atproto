import { xrpc } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import {
  ForbiddenError,
  Server,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyWrite, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, did, rev } = input.body

      const spaceUri = new SpaceUri(space)
      const ownerDid = spaceUri.spaceDid

      // The JWT is signed by the writer's keypair, so iss is the authoritative
      // identity of the caller. Require it to match the claimed writer so a
      // PDS can't deliver a notification on someone else's behalf.
      if (auth.credentials.iss !== did) {
        throw new ForbiddenError(
          'notifyWrite iss does not match claimed writer',
        )
      }

      // Only the space owner's PDS has the member list and fan-out state; for
      // non-owner PDSes this handler is a no-op (e.g. re-delivery to a
      // syncing service that also hosts a replica).
      const account = await ctx.accountManager.getAccount(ownerDid)
      if (!account) return

      const [isMember, recipients] = await ctx.actorStore.read(
        ownerDid,
        async (store) => {
          return [
            await store.space.isMember(space, did),
            await store.space.getCredentialRecipients(space),
          ] as const
        },
      )
      if (!isMember) {
        throw new ForbiddenError(
          'notifyWrite writer is not a member of the space',
        )
      }

      const keypair = await ctx.actorStore.keypair(ownerDid)
      for (const recipient of recipients) {
        const { headers } = await createServiceAuthHeaders({
          iss: ownerDid,
          aud: recipient.serviceDid,
          lxm: com.atproto.space.notifyWrite.$lxm,
          keypair,
        })
        xrpc(recipient.serviceEndpoint, com.atproto.space.notifyWrite, {
          headers,
          body: { space, did, rev },
        }).catch(() => {
          // Best effort — notification delivery is not guaranteed
        })
      }
    },
  })
}
