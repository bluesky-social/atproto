import { AuthScope } from '../../../../auth-verifier'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteSession(async ({ req }) => {
    if (ctx.entrywayAgent) {
      await ctx.entrywayAgent.com.atproto.server.deleteSession(
        undefined,
        authPassthru(req, true),
      )
      return
    }

    const result = ctx.authVerifier.validateBearerToken(
      req,
      [AuthScope.Refresh],
      { ignoreExpiration: true },
    )
    const id = result.payload.jti
    if (!id) {
      throw new Error('Unexpected missing refresh token id')
    }

    await ctx.accountManager.revokeRefreshToken(id)
  })
}
