import { InvalidRequestError } from '@atproto/xrpc-server'
import { INVALID_HANDLE } from '@atproto/syntax'

import { formatAccountStatus } from '../../../../account-manager'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { authPassthru, resultPassthru } from '../../../proxy'
import { didDocForSession } from './util'
import { AuthScope } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.SignupQueued],
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        return resultPassthru(
          await ctx.entrywayAgent.com.atproto.server.getSession(
            undefined,
            authPassthru(req),
          ),
        )
      }

      const did = auth.credentials.did
      const [user, didDoc] = await Promise.all([
        ctx.accountManager.getAccount(did, { includeDeactivated: true }),
        didDocForSession(ctx, did),
      ])
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }

      const { status, active } = formatAccountStatus(user)

      return {
        encoding: 'application/json',
        body: {
          handle: user.handle ?? INVALID_HANDLE,
          did: user.did,
          email: user.email ?? undefined,
          didDoc,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        },
      }
    },
  })
}
