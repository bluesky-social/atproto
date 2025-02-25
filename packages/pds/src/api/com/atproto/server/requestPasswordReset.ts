import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestPasswordReset({
    rateLimit: [
      {
        durationMs: DAY,
        points: 50,
      },
      {
        durationMs: HOUR,
        points: 15,
      },
    ],
    handler: async ({ input, req }) => {
      const email = input.body.email.toLowerCase()

      const account = await ctx.accountManager.getAccountByEmail(email, {
        includeDeactivated: true,
        includeTakenDown: true,
      })

      if (!account?.email) {
        if (ctx.entrywayAgent) {
          await ctx.entrywayAgent.com.atproto.server.requestPasswordReset(
            input.body,
            ctx.entrywayPassthruHeaders(req),
          )
          return
        }
        throw new InvalidRequestError('account does not have an email address')
      }

      const token = await ctx.accountManager.createEmailToken(
        account.did,
        'reset_password',
      )
      await ctx.mailer.sendResetPassword(
        { handle: account.handle ?? account.email, token },
        { to: account.email },
      )
    },
  })
}
