import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import disposable from 'disposable-email'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.updateEmail({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body
      if (!disposable.validate(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }
      const account = await ctx.accountManager.getAccount(did)
      if (!account) {
        throw new InvalidRequestError('account not found')
      }
      // require valid token if account email is confirmed
      if (account.emailConfirmedAt) {
        if (!token) {
          throw new InvalidRequestError(
            'confirmation token required',
            'TokenRequired',
          )
        }
        await ctx.accountManager.assertValidEmailToken(
          did,
          'update_email',
          token,
        )
      }

      await ctx.accountManager.updateEmail({ did, email, token })
    },
  })
}
