import { INVALID_HANDLE } from '@atproto/syntax'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'
import { authPassthru, resultPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.refreshSession({
    auth: ctx.authVerifier.refresh,
    handler: async ({ auth, req }) => {
      const did = auth.credentials.did
      const user = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
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

      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.refreshSession(
            undefined,
            authPassthru(req),
          ),
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
          accessJwt: rotated.accessJwt,
          refreshJwt: rotated.refreshJwt,
        },
      }
    },
  })
}
