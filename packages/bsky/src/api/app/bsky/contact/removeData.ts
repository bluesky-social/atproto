import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import { app } from '../../../../lexicons/index.js'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.removeData, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      await callRolodexClient(
        ctx.rolodexClient.removeData({
          actor,
        }),
      )

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
