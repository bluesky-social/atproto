import { AuthScope } from '../../../../auth-verifier'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteSession(async ({ req }) => {
    const result = ctx.authVerifier.validateBearerToken(
      req,
      [AuthScope.Refresh],
      { ignoreExpiration: true },
    )
    const id = result.payload.jti
    if (!id) {
      throw new Error('Unexpected missing refresh token id')
    }

    await ctx.services.auth(ctx.db).revokeRefreshToken(id)
  })
}
