import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    checkTakedown: true,
    scopes: ACCESS_FULL,
    authorize: () => {
      throw new ForbiddenError(
        'OAuth credentials are not supported for this endpoint',
      )
    },
  })

  if (entrywayClient) {
    server.add(com.atproto.server.createAppPassword, {
      auth,
      handler: async ({ input: { body }, auth, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.createAppPassword.$lxm,
        )

        return entrywayClient.xrpc(com.atproto.server.createAppPassword, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.server.createAppPassword, {
      auth,
      handler: async ({ input: { body }, auth }) => {
        const { name } = body
        const appPassword = await ctx.accountManager.createAppPassword(
          auth.credentials.did,
          name,
          body.privileged ?? false,
        )

        return {
          encoding: 'application/json' as const,
          body: appPassword,
        }
      },
    })
  }
}
