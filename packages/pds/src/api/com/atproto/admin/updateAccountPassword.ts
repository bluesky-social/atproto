import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.updateAccountPassword, {
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input, req }) => {
      if (ctx.entrywayClient) {
        await ctx.entrywayClient.com.atproto.admin.updateAccountPassword(
          input.body,
          ctx.entrywayPassthruHeaders(req),
        )
        return
      }

      const { did, password } = input.body

      if (password.length > NEW_PASSWORD_MAX_LENGTH) {
        throw new InvalidRequestError('Invalid password length.')
      }

      await ctx.accountManager.updateAccountPassword({ did, password })
    },
  })
}
