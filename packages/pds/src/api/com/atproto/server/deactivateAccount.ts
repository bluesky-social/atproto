import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { ACCESS_FULL, AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    additional: [AuthScope.Takendown],
    scopes: ACCESS_FULL,
    authorize: () => {
      throw new ForbiddenError(
        'OAuth credentials are not supported for this endpoint',
      )
    },
  })

  if (entrywayClient) {
    server.add(com.atproto.server.deactivateAccount, {
      auth,
      // in the case of entryway, the full flow is deactivateAccount (PDS) -> deactivateAccount (Entryway) -> updateSubjectStatus(PDS)
      handler: async ({ input: { body }, req }) => {
        const { headers } = ctx.entrywayPassthruHeaders(req)
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
        const requester = auth.credentials.did
        await ctx.accountManager.deactivateAccount(
          requester,
          body.deleteAfter ?? null,
        )
        const status = await ctx.accountManager.getAccountStatus(requester)
        await ctx.sequencer.sequenceAccountEvt(requester, status)
      },
    })
  }
}
