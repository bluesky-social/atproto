import { MINUTE } from '@atproto/common'
import {
  InvalidRequestError,
  MethodRateLimit,
  Server,
} from '@atproto/xrpc-server'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const rateLimit: MethodRateLimit<
    void,
    com.atproto.server.resetPassword.$Params,
    com.atproto.server.resetPassword.$Input
  > = [
    {
      durationMs: 5 * MINUTE,
      points: 50,
    },
  ]

  if (entrywayClient) {
    server.add(com.atproto.server.resetPassword, {
      rateLimit,
      handler: async ({ input: { body }, req }) => {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.resetPassword, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.server.resetPassword, {
      rateLimit,
      handler: async ({ input: { body } }) => {
        const { token, password } = body

        if (password.length > NEW_PASSWORD_MAX_LENGTH) {
          throw new InvalidRequestError('Invalid password length.')
        }

        await ctx.accountManager.resetPassword({ token, password })
      },
    })
  }
}
