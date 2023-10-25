import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.confirmEmail({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body

      const user = await ctx.accountManager.getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (user.email !== email.toLowerCase()) {
        throw new InvalidRequestError('invalid email', 'InvalidEmail')
      }
      await ctx.accountManager.confirmEmail({ did, token })
    },
  })
}
