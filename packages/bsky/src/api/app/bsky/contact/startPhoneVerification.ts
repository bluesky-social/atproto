import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.startPhoneVerification, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      await callRolodexClient(
        ctx.rolodexClient.startPhoneVerification({
          actor,
          phone: input.body.phone,
        }),
      )

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
