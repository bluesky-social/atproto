import { INVALID_HANDLE } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.refreshSession({
    auth: ctx.authVerifier.refresh,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.accountManager.getAccount(did, true)
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

      const [didDoc, rotated] = await Promise.all([
        didDocForSession(ctx, user.did),
        ctx.accountManager.rotateRefreshToken(auth.credentials.tokenId),
      ])
      if (rotated === null) {
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          didDoc,
          handle: user.handle ?? INVALID_HANDLE,
          accessJwt: rotated.access.jwt,
          refreshJwt: rotated.refresh.jwt,
        },
      }
    },
  })
}
