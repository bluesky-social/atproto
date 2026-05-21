import { DAY, MINUTE } from '@atproto/common'
import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.identity.updateHandle, {
    auth: ctx.authVerifier.authorization({
      checkTakedown: true,
      authorize: (permissions) => {
        permissions.assertIdentity({ attr: 'handle' })
      },
    }),
    rateLimit: [
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
    ],
    handler: async ({ auth, input, req }) => {
      const requester = auth.credentials.did

      if (ctx.entrywayClient) {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.identity.updateHandle.$lxm,
        )
        // the full flow is:
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        await ctx.entrywayClient.xrpc(com.atproto.identity.updateHandle, {
          headers,
          body: {
            handle: input.body.handle,
            // @ts-expect-error "did" is not in the schema
            did: requester,
          },
        })
        return
      }

      await ctx.accountManager.updateHandle(requester, input.body.handle)
    },
  })
}
