import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    authorize: () => {
      throw new ForbiddenError(
        'OAuth credentials are not supported for this endpoint',
      )
    },
  })

  if (entrywayClient) {
    server.add(com.atproto.server.listAppPasswords, {
      auth,
      handler: async ({ auth, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.listAppPasswords.$lxm,
        )

        return entrywayClient.xrpc(com.atproto.server.listAppPasswords, {
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.listAppPasswords, {
      auth,
      handler: async ({ auth }) => {
        const passwords = await ctx.accountManager.listAppPasswords(
          auth.credentials.did,
        )
        return {
          encoding: 'application/json',
          body: { passwords },
        }
      },
    })
  }
}
