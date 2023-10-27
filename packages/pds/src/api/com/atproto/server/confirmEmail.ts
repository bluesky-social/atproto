import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.confirmEmail({
    auth: ctx.authVerifier.accessCheckTakedown,
    handler: async ({ auth, input, req }) => {
      const did = auth.credentials.did

      const user = await ctx.accountManager.getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.confirmEmail(
          input.body,
          authPassthru(req, true),
        )
        return
      }

      const { token, email } = input.body

      if (user.email !== email.toLowerCase()) {
        throw new InvalidRequestError('invalid email', 'InvalidEmail')
      }
      await ctx.accountManager.confirmEmail({ did, token })
    },
  })
}
