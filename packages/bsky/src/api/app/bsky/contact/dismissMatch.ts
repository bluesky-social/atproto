import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.dismissMatch({
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
