import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    scopes: ACCESS_FULL,
    authorize: () => {
      throw new ForbiddenError(
        'OAuth credentials are not supported for this endpoint',
      )
    },
  })

  if (entrywayClient) {
    // in the case of entryway, the full flow is activateAccount (PDS) -> activateAccount (Entryway) -> updateSubjectStatus(PDS)
    server.add(com.atproto.server.activateAccount, {
      auth,
      handler: async ({ req }) => {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        await entrywayClient.xrpc(com.atproto.server.activateAccount, {
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.activateAccount, {
      auth,
      handler: async ({ auth }) => {
        await ctx.accountManager.activateAccount(auth.credentials.did)
      },
    })
  }
}
