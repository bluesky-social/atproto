import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.verifyPhone, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      const res = await callRolodexClient(
        ctx.rolodexClient.verifyPhone({
          actor,
          verificationCode: input.body.code,
          phone: input.body.phone,
        }),
      )

      return {
        encoding: 'application/json',
        body: {
          token: res.token,
        },
      }
    },
  })
}
