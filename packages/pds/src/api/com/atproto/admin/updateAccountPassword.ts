import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountPassword({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth, req }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError(
          'Must be an admin to update an account password',
        )
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.admin.updateAccountPassword(
          input.body,
          authPassthru(req, true),
        )
        return
      }

      const { did, password } = input.body
      await ctx.accountManager.updateAccountPassword({ did, password })
    },
  })
}
