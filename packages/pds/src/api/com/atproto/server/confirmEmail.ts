import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.confirmEmail, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'email', action: 'manage' })
      },
    }),
    handler: async ({ auth, input, req }) => {
      const did = auth.credentials.did

      const user = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
      })
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (ctx.entrywayClient) {
        await ctx.entrywayClient.com.atproto.server.confirmEmail(
          input.body,
          await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
            ids.ComAtprotoServerConfirmEmail,
          ),
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
