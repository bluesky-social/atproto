import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailConfirmation({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const acccount = await ctx.accountManager.getAccount(did)
      if (!acccount) {
        throw new InvalidRequestError('acccount not found')
      }
      const token = await ctx.accountManager.createEmailToken(
        did,
        'confirm_email',
      )
      await ctx.mailer.sendConfirmEmail({ token }, { to: acccount.email })
    },
  })
}
