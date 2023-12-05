import { InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestPasswordReset(async ({ input, req }) => {
    const email = input.body.email.toLowerCase()

    const account = await ctx.accountManager.getAccountByEmail(email)

    if (!account?.email) {
      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.requestPasswordReset(
          input.body,
          authPassthru(req, true),
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
      { identifier: account.handle ?? account.email, token },
      { to: account.email },
    )
  })
}
