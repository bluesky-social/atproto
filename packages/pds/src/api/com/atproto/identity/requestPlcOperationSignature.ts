import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.requestPlcOperationSignature({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth }) => {
      const did = auth.credentials.did

      const account = await ctx.services.account(ctx.db).getAccount(did, true)
      if (!account) {
        throw new InvalidRequestError('account not found')
      }
      if (!account) {
        throw new InvalidRequestError('account not found')
      } else if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }
      const token = await ctx.services
        .account(ctx.db)
        .createEmailToken(did, 'plc_operation')
      await ctx.mailer.sendPlcOperation({ token }, { to: account.email })
    },
  })
}
