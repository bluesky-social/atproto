import { ComAtprotoServerGetSession } from '@atproto/api'
import { INVALID_HANDLE } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { formatAccountStatus } from '../../../../account-manager/account-manager'
import { AccessOutput, AuthScope, OAuthOutput } from '../../../../auth-verifier'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getSession({
    auth: ctx.authVerifier.accessStandard({
      additional: [AuthScope.SignupQueued],
    }),
    handler: async ({ auth, req }) => {
      if (ctx.entrywayAgent) {
        // Allow proxying of dpop bound requests by using service auth instead
        const headers =
          auth.credentials.type === 'oauth' // DPoP bound tokens cannot be proxied
            ? await ctx.entrywayAuthHeaders(
                req,
                auth.credentials.did,
                'com.atproto.server.getSession',
              )
            : ctx.entrywayPassthruHeaders(req)

        const res = await ctx.entrywayAgent.com.atproto.server.getSession(
          undefined,
          headers,
        )

        return {
          encoding: 'application/json',
          body: output(auth, res.data),
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
          handle: user.handle ?? INVALID_HANDLE,
          did: user.did,
          email: user.email ?? undefined,
          didDoc,
          emailConfirmed: !!user.emailConfirmedAt,
          active,
          status,
        }),
      }
    },
  })
}

function output(
  { credentials }: AccessOutput | OAuthOutput,
  data: ComAtprotoServerGetSession.OutputSchema,
): ComAtprotoServerGetSession.OutputSchema {
  switch (credentials.type) {
    case 'access':
      return data

    case 'oauth':
      if (!credentials.oauthScopes.has('transition:email')) {
        const { email, emailAuthFactor, emailConfirmed, ...rest } = data
        return rest
      }

      return data

    default:
      // @ts-expect-error
      throw new Error(`Unknown credentials type: ${credentials.type}`)
  }
}
