import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.refreshSession({
    auth: ctx.refreshVerifier,
    handler: async ({ req, auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.account(ctx.db).getAccount(did, true)
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const lastRefreshId = ctx.auth.verifyToken(
        ctx.auth.getToken(req) ?? '',
      ).jti
      if (!lastRefreshId) {
        throw new Error('Unexpected missing refresh token id')
      }

      const access = ctx.auth.createAccessToken(user.did)

      const refresh = await ctx.db.transaction(async (dbTxn) => {
        const authTxn = ctx.services.auth(dbTxn)
        const nextId = await authTxn.rotateRefreshToken(lastRefreshId)
        if (!nextId) return null
        const refresh = ctx.auth.createRefreshToken(user.did, nextId)
        await authTxn.grantRefreshToken(refresh.payload)
        return refresh
      })

      if (refresh === null) {
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          handle: user.handle,
          accessJwt: access.jwt,
          refreshJwt: refresh.jwt,
        },
      }
    },
  })
}
