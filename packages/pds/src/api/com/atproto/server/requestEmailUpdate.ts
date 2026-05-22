import { DAY, HOUR } from '@atproto/common'
import {
  ForbiddenError,
  MethodAuthVerifier,
  MethodRateLimit,
  Server,
} from '@atproto/xrpc-server'
import { AccessOutput, OAuthOutput } from '../../../../auth-output.js'
import { ACCESS_FULL } from '../../../../auth-scope.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

// Exposed as a utility to ensure auth in updateEmail and requestEmailUpdate
// stay consistent.
export function requestEmailUpdateAuth(
  ctx: AppContext,
): MethodAuthVerifier<AccessOutput | OAuthOutput> {
  return ctx.authVerifier.authorization({
    checkTakedown: true,
    scopes: ACCESS_FULL,
    authorize: () => {
      throw new ForbiddenError(
        'Use the account manager interface to update email address associated with an account',
      )
    },
  })
}

const rateLimit: MethodRateLimit<AccessOutput | OAuthOutput> = [
  {
    durationMs: DAY,
    points: 15,
    calcKey: ({ auth }) => auth.credentials.did,
  },
  {
    durationMs: HOUR,
    points: 5,
    calcKey: ({ auth }) => auth.credentials.did,
  },
]

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = requestEmailUpdateAuth(ctx)

  if (entrywayClient) {
    server.add(com.atproto.server.requestEmailUpdate, {
      rateLimit,
      auth,
      handler: async ({ auth, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.requestEmailUpdate.$lxm,
        )

        return entrywayClient.xrpc(com.atproto.server.requestEmailUpdate, {
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.requestEmailUpdate, {
      rateLimit,
      auth,
      handler: async ({ auth }) => {
        const did = auth.credentials.did

        // @TODO get the locale somehow (either by adding a field in the request
        // body, or by using the `Accept-Language` header).
        const locale = undefined

        const { tokenRequired } = await ctx.accountManager.requestEmailUpdate(
          did,
          { locale },
        )

        return {
          encoding: 'application/json' as const,
          body: { tokenRequired },
        }
      },
    })
  }
}
