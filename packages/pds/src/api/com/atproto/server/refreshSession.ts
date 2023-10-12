import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.refreshSession({
    auth: ctx.authVerifier.refresh,
    handler: async ({ auth }) => {
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

      const res = await ctx.db.transaction((dbTxn) => {
        return ctx.services
          .auth(dbTxn)
          .rotateRefreshToken(auth.credentials.tokenId)
      })
      if (res === null) {
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          handle: user.handle,
          accessJwt: res.access.jwt,
          refreshJwt: res.refresh.jwt,
        },
      }
    },
  })
}
