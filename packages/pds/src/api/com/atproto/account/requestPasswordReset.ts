import { randomStr } from '@atproto/crypto'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.account.requestPasswordReset(async ({ input }) => {
    const email = input.body.email.toLowerCase()

    const user = await ctx.services.actor(ctx.db).getUserByEmail(email)

    if (user) {
      const token = getSixDigitToken()
      const grantedAt = new Date().toISOString()
      await ctx.db.db
        .updateTable('user')
        .where('handle', '=', user.handle)
        .set({
          passwordResetToken: token,
          passwordResetGrantedAt: grantedAt,
        })
        .execute()
      await ctx.mailer.sendResetPassword(
        { handle: user.handle, token },
        { to: user.email },
      )
    }
  })
}

const getSixDigitToken = () => randomStr(4, 'base10').slice(0, 6)
