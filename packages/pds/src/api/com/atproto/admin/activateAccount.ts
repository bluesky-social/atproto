import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthRequiredError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.activateAccount({
    auth: ctx.authVerifier.role,
    handler: async ({ auth, input }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }

      await ctx.accountManager.activateAccount(input.body.did)
    },
  })
}
