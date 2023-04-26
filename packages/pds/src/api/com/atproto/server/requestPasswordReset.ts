import { randomStr } from '@atproto/crypto'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestPasswordReset(async ({ input }) => {
    const email = input.body.email.toLowerCase()

    const user = await ctx.services.account(ctx.db).getAccountByEmail(email)

    if (user) {
      const token = getToken()
      const grantedAt = new Date().toISOString()
      await ctx.db.db
        .updateTable('user_account')
        .where('did', '=', user.did)
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

const randFive = () => randomStr(5, 'base32').slice(0, 5)
const getToken = () => randFive() + '-' + randFive()
