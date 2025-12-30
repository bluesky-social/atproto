import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { assertRolodexOrThrowUnimplemented, callRolodexClient } from './util'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.contact.verifyPhone({
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
