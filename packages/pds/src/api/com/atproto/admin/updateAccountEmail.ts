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
      await ctx.db.transaction(async (dbTxn) => {
        const accntService = ctx.services.account(dbTxn)
        const account = await accntService.getAccount(input.body.account)
        if (!account) {
          throw new InvalidRequestError(
            `Account does not exist: ${input.body.account}`,
          )
        }
        await accntService.updateEmail(account.did, input.body.email)
      })
    },
  })
}
