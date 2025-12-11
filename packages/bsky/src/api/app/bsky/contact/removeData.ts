import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.removeData({
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
