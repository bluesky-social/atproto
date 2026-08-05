import { AuthRequiredError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { toSpaceRef } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifySpaceDeleted, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, repo } = input.body

      const { spaceDid } = toSpaceRef(space)
      if (auth.credentials.iss !== spaceDid) {
        throw new AuthRequiredError(
          'JWT issuer must be the space DID',
          'UntrustedIss',
        )
      }

      // No repo named, or an account this host doesn't hold: nothing to flag. A
      // syncer implementation drops its copy of the space here instead.
      if (!repo) return
      const account = await ctx.accountManager.getAccount(repo)
      if (!account) return

      await ctx.actorStore.transact(repo, async (actorTxn) => {
        const existing = await actorTxn.space.getSpace(space)
        if (!existing) return
        await actorTxn.space.markSpaceDeleted(space)
      })
    },
  })
}
