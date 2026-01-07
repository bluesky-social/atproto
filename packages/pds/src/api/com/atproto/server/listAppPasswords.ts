import { ForbiddenError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  server.add(com.atproto.server.listAppPasswords, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        throw new ForbiddenError(
          'OAuth credentials are not supported for this endpoint',
        )
      },
    }),
    handler: entrywayClient
      ? async ({ auth, req }) => {
          const { headers } = await ctx.entrywayAuthHeaders(
            req,
            auth.credentials.did,
            com.atproto.server.listAppPasswords.$lxm,
          )

          return entrywayClient.xrpc(com.atproto.server.listAppPasswords, {
            validateResponse: false, // ignore invalid upstream responses
            headers,
          })
        }
      : async ({
          auth,
        }): Promise<com.atproto.server.listAppPasswords.Output> => {
          const passwords = await ctx.accountManager.listAppPasswords(
            auth.credentials.did,
          )
          return {
            encoding: 'application/json' as const,
            body: { passwords },
          }
        },
  })
}
