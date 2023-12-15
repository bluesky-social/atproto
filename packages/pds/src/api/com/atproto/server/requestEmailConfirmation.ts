import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailConfirmation({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, req }) => {
      const did = auth.credentials.did
      const account = await ctx.accountManager.getAccount(did)
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.requestEmailConfirmation(
          undefined,
          authPassthru(req),
        )
        return
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }
      const token = await ctx.accountManager.createEmailToken(
        did,
        'confirm_email',
      )
      await ctx.mailer.sendConfirmEmail({ token }, { to: account.email })
    },
  })
}
