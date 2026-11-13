import { DAY, HOUR } from '@atproto/common'
import type {
  MethodAuthVerifier,
  MethodRateLimit,
  Server,
} from '@atproto/xrpc-server'
import type { AccessOutput, OAuthOutput } from '../../../../auth-output.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

// Exposed as a utility to ensure auth in confirmEmail and requestEmailConfirmation
export function requestEmailConfirmationAuth(
  ctx: AppContext,
): MethodAuthVerifier<AccessOutput | OAuthOutput> {
  return ctx.authVerifier.authorization({
    checkTakedown: true,
    authorize: (permissions) => {
      permissions.assertAccount({ attr: 'email', action: 'manage' })
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

  const auth = requestEmailConfirmationAuth(ctx)

  if (entrywayClient) {
    server.add(com.atproto.server.requestEmailConfirmation, {
      auth,
      rateLimit,
      handler: async ({ auth, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.requestEmailConfirmation.$lxm,
        )

        await entrywayClient.xrpc(com.atproto.server.requestEmailConfirmation, {
          headers,
        })
      },
    })
  } else {
    server.add(com.atproto.server.requestEmailConfirmation, {
      auth,
      rateLimit,
      handler: async ({ auth }) => {
        const did = auth.credentials.did
        const locale = undefined // @TODO get the locale somehow
        await ctx.accountManager.requestEmailConfirmation(did, { locale })
      },
    })
  }
}
