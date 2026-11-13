import type { Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    additional: [AuthScope.Takendown],
    scopes: ACCESS_FULL,
    authorize: (permissions) => {
      permissions.assertAccount({ attr: 'status', action: 'manage' })
    },
  })

  if (entrywayClient) {
    server.add(com.atproto.server.deactivateAccount, {
      auth,
      // in the case of entryway, the full flow is deactivateAccount (PDS) -> deactivateAccount (Entryway) -> updateSubjectStatus(PDS)
      handler: async ({ input: { body }, auth, req }) => {
        // DPoP bound credentials cannot be forwarded as-is, so OAuth callers
        // are authenticated towards the entryway using entryway auth instead.
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.deactivateAccount.$lxm,
        )

        await entrywayClient.xrpc(com.atproto.server.deactivateAccount, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.server.deactivateAccount, {
      auth,
      handler: async ({ input: { body }, auth }) => {
        await ctx.accountManager.deactivateAccount(auth.credentials.did, {
          // For legacy reasons we check if it's an oauth credential before passing
          // deleteCredentials since it did not before.
          // @TODO Investiage why the deleteCredentials was not passed previously and
          // address it in a different line of work
          deleteCredentials: auth.credentials.type === 'oauth',
          deleteAfter: body.deleteAfter ?? null,
        })
      },
    })
  }
}
