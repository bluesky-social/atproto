import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestPasswordReset(async ({ input }) => {
    const email = input.body.email.toLowerCase()

    const account = await ctx.accountManager.getAccountByEmail(email)

    if (account) {
      const token = await ctx.accountManager.createEmailToken(
        account.did,
        'reset_password',
      )
      await ctx.mailer.sendResetPassword(
        { identifier: account.handle ?? account.email, token },
        { to: account.email },
      )
    }
  })
}
