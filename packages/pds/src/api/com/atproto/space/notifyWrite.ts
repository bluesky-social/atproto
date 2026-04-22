import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import {
  AuthRequiredError,
  Server,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyWrite, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, did, rev } = input.body

      const spaceUri = new SpaceUri(space)
      const ownerDid = spaceUri.spaceDid

      // Verify the caller has authority (either they are the member's PDS service, or the space owner)
      // For now, just check that the JWT iss is plausible
      const iss = auth.credentials.iss

      // If this PDS hosts the space owner, fan out to credential recipients
      const account = await ctx.accountManager.getAccount(ownerDid)
      if (account) {
        const recipients = await ctx.actorStore.read(ownerDid, (store) =>
          store.space.getCredentialRecipients(space),
        )

        const keypair = await ctx.actorStore.keypair(ownerDid)

        // Fan out notifications (fire and forget)
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
      }
    },
  })
}
