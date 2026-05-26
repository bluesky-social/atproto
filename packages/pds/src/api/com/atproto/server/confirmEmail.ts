import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { requestEmailConfirmationAuth } from './requestEmailConfirmation.js'

export default function (server: Server, ctx: AppContext) {
  const { entrywayClient } = ctx

  // @NOTE Ensure that both endpoints use the same authentication logic
  const auth = requestEmailConfirmationAuth(ctx)

  if (entrywayClient) {
    server.add(com.atproto.server.confirmEmail, {
      auth,
      handler: async ({ auth, input: { body }, req }) => {
        const { headers } = await ctx.entrywayAuthHeaders(
          req,
          auth.credentials.did,
          com.atproto.server.confirmEmail.$lxm,
        )
        await entrywayClient.xrpc(com.atproto.server.confirmEmail, {
          headers,
          body,
        })
      },
    })
  } else {
    server.add(com.atproto.server.confirmEmail, {
      auth,
      handler: async ({ auth, input: { body } }) => {
        await ctx.accountManager.confirmEmail(
          auth.credentials.did,
          body.email,
          body.token,
        )
      },
    })
  }
}
