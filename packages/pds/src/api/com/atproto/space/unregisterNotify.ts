import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertCredentialSpace, assertSpaceHost } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.unregisterNotify, {
    auth: ctx.authVerifier.spaceCredentialAuth,
    handler: async ({ input, auth }) => {
      const { space, service } = input.body

      assertCredentialSpace(auth.credentials, space)

      const spaceDid = await assertSpaceHost(ctx, space)

      await ctx.actorStore.read(spaceDid, (store) =>
        store.space.getActiveSpaceConfig(space),
      )

      // Not resolved here: a subscriber whose DID document has since changed must
      // still be able to withdraw. Succeeds when nothing was registered.
      await ctx.actorStore.transact(spaceDid, (actorTxn) =>
        actorTxn.space.removeCredentialRecipient(space, service),
      )
    },
  })
}
