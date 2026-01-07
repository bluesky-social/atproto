import { DidString, HandleString, INVALID_HANDLE } from '@atproto/syntax'
import {
  AuthRequiredError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { com } from '../../../../lexicons/index.js'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.refreshSession, {
    auth: ctx.authVerifier.refresh(),
    handler: async ({
      auth,
      req,
    }): Promise<com.atproto.server.refreshSession.Output> => {
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

      if (ctx.entrywayClient) {
        const { headers } = ctx.entrywayPassthruHeaders(req)
        return ctx.entrywayClient.xrpc(com.atproto.server.refreshSession, {
          validateResponse: false, // ignore invalid upstream responses
          headers,
        })
      }

      const [didDoc, rotated] = await Promise.all([
        didDocForSession(ctx, user.did),
        ctx.accountManager.rotateRefreshToken(auth.credentials.tokenId),
      ])
      if (rotated === null) {
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }

      const { status, active } = formatAccountStatus(user)

      return {
        encoding: 'application/json' as const,
        body: {
          accessJwt: rotated.accessJwt,
          refreshJwt: rotated.refreshJwt,

          did: user.did as DidString,
          // @ts-expect-error https://github.com/bluesky-social/atproto/pull/4406
          didDoc,
          handle: (user.handle ?? INVALID_HANDLE) as HandleString,
          email: user.email ?? undefined,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        },
      }
    },
  })
}
