import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.revokeAppPassword, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: entrywayClient
      ? async ({ auth, input: { body }, req }) => {
          const { headers } = await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
            com.atproto.server.revokeAppPassword.$lxm,
          )

          await entrywayClient.xrpc(com.atproto.server.revokeAppPassword, {
            validateResponse: false, // ignore invalid upstream responses
            headers,
            body,
          })
        }
      : async ({ auth, input: { body } }) => {
          const requester = auth.credentials.did

          await ctx.accountManager.revokeAppPassword(requester, body.name)
        },
  })
}
