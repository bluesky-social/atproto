import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.startPhoneVerification({
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
