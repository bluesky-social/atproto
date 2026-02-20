import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { app } from '../../../../lexicons/index.js'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.contact.dismissMatch, {
    auth: ctx.authVerifier.standard,
    handler: async ({ input, auth }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      await callRolodexClient(
        ctx.rolodexClient.dismissMatch({
          actor,
          subject: input.body.subject,
        }),
      )

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
