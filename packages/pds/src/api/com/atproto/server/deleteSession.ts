import { AuthRequiredError } from '@atproto/xrpc-server'
import { AuthScope } from '../../../../auth'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteSession(async ({ req }) => {
    const token = ctx.auth.getToken(req)
    if (!token) {
      throw new AuthRequiredError()
    }
    const refreshToken = ctx.auth.verifyToken(token, [AuthScope.Refresh], {
      ignoreExpiration: true,
    })
    if (!refreshToken.jti) {
      throw new Error('Unexpected missing refresh token id')
    }

    await ctx.services.auth(ctx.db).revokeRefreshToken(refreshToken.jti)
  })
}
