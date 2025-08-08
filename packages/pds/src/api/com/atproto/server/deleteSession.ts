import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  const { entrywayAgent } = ctx
  if (entrywayAgent) {
    server.com.atproto.server.deleteSession(async ({ req }) => {
      await entrywayAgent.com.atproto.server.deleteSession(
        undefined,
        ctx.entrywayPassthruHeaders(req),
      )
    })
  } else {
    server.com.atproto.server.deleteSession({
      auth: ctx.authVerifier.refresh({
        allowExpired: true,
      }),
      handler: async ({ auth }) => {
        await ctx.accountManager.revokeRefreshToken(auth.credentials.tokenId)
      },
    })
  }
}
