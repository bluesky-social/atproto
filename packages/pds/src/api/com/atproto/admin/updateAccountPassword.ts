import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.admin.updateAccountPassword, {
    auth: ctx.authVerifier.adminToken,
    handler: entrywayClient
      ? async ({ input: { body }, req }) => {
          const { headers } = ctx.entrywayPassthruHeaders(req)
          await entrywayClient.xrpc(com.atproto.admin.updateAccountPassword, {
            validateResponse: false, // ignore invalid upstream responses
            body,
            headers,
          })
        }
      : async ({ input: { body } }) => {
          const { did, password } = body

          if (password.length > NEW_PASSWORD_MAX_LENGTH) {
            throw new InvalidRequestError('Invalid password length.')
          }

          await ctx.accountManager.updateAccountPassword({ did, password })
        },
  })
}
