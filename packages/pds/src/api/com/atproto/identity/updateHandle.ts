import { DAY, MINUTE } from '@atproto/common'
import { MethodRateLimit, Server } from '@atproto/xrpc-server'
import { AccessOutput, OAuthOutput } from '../../../../auth-output.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  const auth = ctx.authVerifier.authorization({
    checkTakedown: true,
    authorize: (permissions) => {
      permissions.assertIdentity({ attr: 'handle' })
    },
  })

  const rateLimit: MethodRateLimit<AccessOutput | OAuthOutput> = [
    {
      durationMs: 5 * MINUTE,
      points: 10,
      calcKey: ({ auth }) => auth.credentials.did,
    },
    {
      durationMs: DAY,
      points: 50,
      calcKey: ({ auth }) => auth.credentials.did,
    },
  ]

  if (entrywayClient) {
    server.add(com.atproto.identity.updateHandle, {
      auth,
      rateLimit,
      handler: async ({ auth, input, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.identity.updateHandle.$lxm,
        )

        // The full flow is:
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        await entrywayClient.xrpc(com.atproto.identity.updateHandle, {
          headers,
          body: {
            handle: input.body.handle,
            // @ts-expect-error "did" is not in the schema
            did: auth.credentials.did,
          },
        })
      },
    })
  } else {
    server.add(com.atproto.identity.updateHandle, {
      auth,
      rateLimit,
      handler: async ({ auth, input }) => {
        await ctx.accountManager.updateHandle(
          auth.credentials.did,
          input.body.handle,
        )
      },
    })
  }
}
