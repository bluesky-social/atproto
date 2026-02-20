import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.confirmEmail, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertAccount({ attr: 'email', action: 'manage' })
      },
    }),
    handler: async ({ auth, input: { body }, req }) => {
      const { did } = auth.credentials

      const user = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
      })
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.confirmEmail.$lxm,
        )
        await ctx.entrywayClient.xrpc(com.atproto.server.confirmEmail, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
          body,
        })
        return
      }

      const { token, email } = body

      if (user.email !== email.toLowerCase()) {
        throw new InvalidRequestError('invalid email', 'InvalidEmail')
      }
      await ctx.accountManager.confirmEmail({ did, token })
    },
  })
}
