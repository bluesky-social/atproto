import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailConfirmation({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }
      const token = await ctx.services
        .account(ctx.db)
        .createEmailToken(did, 'confirm_email')
      await ctx.mailer.sendConfirmEmail({ token }, { to: user.email })
    },
  })
}
