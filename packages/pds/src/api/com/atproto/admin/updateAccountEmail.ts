import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountEmail({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const account = await ctx.accountManager.getAccount(input.body.account)
      if (!account) {
        throw new InvalidRequestError(
          `Account does not exist: ${input.body.account}`,
        )
      }
      await ctx.accountManager.updateEmail({
        did: account.did,
        email: input.body.email,
      })
    },
  })
}
