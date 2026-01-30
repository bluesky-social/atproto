import { DAY, HOUR } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.requestPasswordReset, {
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
    handler: async ({ input: { body }, req }) => {
      const email = body.email.toLowerCase()

      const account = await ctx.accountManager.getAccountByEmail(email, {
        includeDeactivated: true,
        includeTakenDown: true,
      })

      if (account?.email) {
        const token = await ctx.accountManager.createEmailToken(
          account.did,
          'reset_password',
        )
        await ctx.mailer.sendResetPassword(
          { handle: account.handle ?? account.email, token },
          { to: account.email },
        )
        return
      }

      if (entrywayClient) {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.requestPasswordReset, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
          body,
        })
        return
      }

      throw new InvalidRequestError('account does not have an email address')
    },
  })
}
