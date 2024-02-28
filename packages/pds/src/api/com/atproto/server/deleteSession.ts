import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { entrywayAgent } = ctx
  if (entrywayAgent) {
    server.com.atproto.server.deleteSession(async (reqCtx) => {
      await entrywayAgent.com.atproto.server.deleteSession(
        undefined,
        authPassthru(reqCtx.req, true),
      )
    })
  } else {
    server.com.atproto.server.deleteSession({
      auth: ctx.authVerifier.refreshExpired,
      handler: async ({ auth }) => {
        await ctx.accountManager.revokeRefreshToken(auth.credentials.tokenId)
      },
    })
  }
}
