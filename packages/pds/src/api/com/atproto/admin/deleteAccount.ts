import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteAccount({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Must be an admin to delete an account')
      }
      const { did } = input.body
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      await ctx.sequencer.sequenceTombstone(did)
      await ctx.sequencer.deleteAllForUser(did)
    },
  })
}
