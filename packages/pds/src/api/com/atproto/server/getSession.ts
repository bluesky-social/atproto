import { l } from '@atproto/lex'
import { INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { AccessOutput, OAuthOutput } from '../../../../auth-output'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { didDocForSession } from './util'
import { com } from '#lexicons'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.getSession, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.SignupQueued],
      authorize: () => {
        // Always allowed. "email" access is checked in the handler.
      },
    }),
    handler: async ({ auth, req, input, params }) => {
      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          'com.atproto.server.getSession',
        )

        const data = await ctx.entrywayClient.call(
          com.atproto.server.getSession,
          undefined,
          { headers },
        )

        return {
          encoding: 'application/json',
          data: output(auth, data),
        }
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
        body: output(auth, {
          handle: (user.handle ?? INVALID_HANDLE) as l.HandleString,
          did: user.did as l.DidString,
          email: user.email ?? undefined,
          // @TODO remove type cast once https://github.com/bluesky-social/atproto/pull/4406 is merged
          didDoc: didDoc as l.LexMap,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        }),
      }
    },
  })
}

function output(
  { credentials }: OAuthOutput | AccessOutput,
  data: com.atproto.server.getSession.Output,
): com.atproto.server.getSession.Output {
  if (
    credentials.type === 'oauth' &&
    !credentials.permissions.allowsAccount({ attr: 'email', action: 'read' })
  ) {
    const { email, emailAuthFactor, emailConfirmed, ...rest } = data
    return rest
  }

  return data
}
