import { MINUTE } from '@atproto/common'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx
  server.add(com.atproto.server.resetPassword, {
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 50,
      },
    ],
    handler: entrywayClient
      ? async ({ input: { body }, req }) => {
          const { headers } = ctx.entrywayPassthruHeaders(req)
          await entrywayClient.xrpc(com.atproto.server.resetPassword, {
            validateResponse: false, // ignore invalid upstream responses
            headers,
            body,
          })
        }
      : async ({ input: { body } }) => {
          const { token, password } = body

          if (password.length > NEW_PASSWORD_MAX_LENGTH) {
            throw new InvalidRequestError('Invalid password length.')
          }

          await ctx.accountManager.resetPassword({ token, password })
        },
  })
}
