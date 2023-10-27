import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.requestEmailUpdate({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, req }) => {
      const did = auth.credentials.did
      const account = await ctx.accountManager.getAccount(did)
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.requestEmailUpdate(
            undefined,
            authPassthru(req),
          ),
        )
      }

      if (!account.email) {
        throw new InvalidRequestError('account does not have an email address')
      }

      const tokenRequired = !!account.emailConfirmedAt
      if (tokenRequired) {
        const token = await ctx.accountManager.createEmailToken(
          did,
          'update_email',
        )
        await ctx.mailer.sendUpdateEmail({ token }, { to: account.email })
      }

      return {
        encoding: 'application/json',
        body: {
          tokenRequired,
        },
      }
    },
  })
}
