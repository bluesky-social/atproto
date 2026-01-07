import { DidString, HandleString, INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { AccessOutput, OAuthOutput } from '../../../../auth-output'
import { AuthScope } from '../../../../auth-scope'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.server.getSession, {
    auth: ctx.authVerifier.authorization({
      additional: [AuthScope.SignupQueued],
      authorize: () => {
        // Always allowed. "email" access is checked in the handler.
      },
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          'com.atproto.server.getSession',
        )

        const { body } = await ctx.entrywayClient.xrpc(
          com.atproto.server.getSession,
          {
            validateResponse: false, // ignore invalid upstream responses
            headers,
          },
        )

        return {
          encoding: 'application/json' as const,
          body: output(auth, body),
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
        encoding: 'application/json' as const,
        body: output(auth, {
          did: user.did as DidString,
          // @ts-expect-error https://github.com/bluesky-social/atproto/pull/4406
          didDoc,
          handle: (user.handle ?? INVALID_HANDLE) as HandleString,
          email: user.email ?? undefined,
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
  data: com.atproto.server.getSession.OutputBody,
): com.atproto.server.getSession.OutputBody {
  if (
    credentials.type === 'oauth' &&
    !credentials.permissions.allowsAccount({ attr: 'email', action: 'read' })
  ) {
    const { email, emailAuthFactor, emailConfirmed, ...rest } = data
    return rest
  }

  return data
}
