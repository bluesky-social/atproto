import { ForbiddenError, type Server } from '@atproto/xrpc-server'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    scopes: ACCESS_FULL,
    // OAuth authorization flows are refused for deactivated accounts, so a
    // client cannot obtain fresh credentials to reactivate an account with.
    authorize: () => {
      throw new ForbiddenError(
        'Account reactivation is not available with OAuth credentials. Sign in to your account management page to reactivate.',
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
