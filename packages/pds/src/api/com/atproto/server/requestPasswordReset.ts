import { DAY, HOUR } from '@atproto/common'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestPasswordReset({
    rateLimit: [
      {
        durationMs: DAY,
        points: 15,
        calcKey: ({ input }) => input.body.email.toLowerCase(),
      },
      {
        durationMs: HOUR,
        points: 5,
        calcKey: ({ input }) => input.body.email.toLowerCase(),
      },
    ],
    handler: async ({ input }) => {
      const email = input.body.email.toLowerCase()

      const user = await ctx.services.account(ctx.db).getAccountByEmail(email)

      if (user) {
        const token = await ctx.services
          .account(ctx.db)
          .createEmailToken(user.did, 'reset_password')
        await ctx.mailer.sendResetPassword(
          { handle: user.handle, token },
          { to: user.email },
        )
      }
    },
  })
}
