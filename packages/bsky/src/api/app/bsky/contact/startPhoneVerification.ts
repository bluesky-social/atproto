import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRolodexOrThrowUnimplemented } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.startPhoneVerification({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      assertRolodexOrThrowUnimplemented(ctx)

      const actor = auth.credentials.iss
      // TODO: Error handling.
      await ctx.rolodexClient.startPhoneVerification({
        actor,
        phone: input.body.phone,
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
