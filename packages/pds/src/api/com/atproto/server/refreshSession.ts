import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { AuthScope } from '../../../../auth'

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
        [],
      ).jti
      if (!lastRefreshId) {
        throw new Error('Unexpected missing refresh token id')
      }

      const res = await ctx.db.transaction(async (dbTxn) => {
        const authTxn = ctx.services.auth(dbTxn)
        const rotateRes = await authTxn.rotateRefreshToken(lastRefreshId)
        if (!rotateRes) return null
        const refresh = ctx.auth.createRefreshToken({
          did: user.did,
          jti: rotateRes.nextId,
        })
        await authTxn.grantRefreshToken(refresh.payload, rotateRes.appPassName)
        return { refresh, appPassName: rotateRes.appPassName }
      })
      if (res === null) {
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }

      const access = ctx.auth.createAccessToken({
        did: user.did,
        scope: res.appPassName === null ? AuthScope.Access : AuthScope.AppPass,
      })

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          handle: user.handle,
          accessJwt: access.jwt,
          refreshJwt: res.refresh.jwt,
        },
      }
    },
  })
}
