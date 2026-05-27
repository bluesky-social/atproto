import { isAtIdentifierString } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import { AuthRequiredError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifySpaceDeleted, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space } = input.body

      const spaceDid = new SpaceUri(space).spaceDid
      if (auth.credentials.iss !== spaceDid) {
        throw new AuthRequiredError(
          'JWT issuer must be the space DID',
          'UntrustedIss',
        )
      }

      const recipientDid = auth.credentials.aud
      if (!isAtIdentifierString(recipientDid)) {
        // aud isn't a recognizable DID/handle — best-effort no-op.
        return
      }
      const account = await ctx.accountManager.getAccount(recipientDid)
      if (!account) {
        // Recipient is not hosted here — best-effort no-op.
        return
      }

      await ctx.actorStore.transact(recipientDid, async (actorTxn) => {
        const existing = await actorTxn.space.getSpace(space)
        if (!existing) return
        await actorTxn.space.markSpaceDeleted(space)
      })
    },
  })
}
