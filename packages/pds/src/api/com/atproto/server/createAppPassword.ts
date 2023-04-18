import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAppPassword({
    auth: ctx.accessVerifierNotAppPassword,
    handler: async ({ auth, input }) => {
      const { name } = input.body
      const appPassword = await ctx.services
        .account(ctx.db)
        .createAppPassword(auth.credentials.did, name)
      return {
        encoding: 'application/json',
        body: appPassword,
      }
    },
  })
}
