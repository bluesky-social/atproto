import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  if (entrywayClient) {
    server.add(com.atproto.server.deleteSession, async ({ req }) => {
      const { headers } = ctx.entrywayPassthruHeaders(req)
      await entrywayClient.xrpc(com.atproto.server.deleteSession, {
        validateResponse: false, // ignore invalid upstream responses
        headers,
      })
    })
  } else {
    server.add(com.atproto.server.deleteSession, {
      auth: ctx.authVerifier.refresh({ allowExpired: true }),
      handler: async ({ auth }) => {
        await ctx.accountManager.revokeRefreshToken(auth.credentials.tokenId)
      },
    })
  }
}
