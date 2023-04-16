import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.listAppPasswords({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const passwords = await ctx.services
        .account(ctx.db)
        .listAppPasswords(auth.credentials.did)
      return {
        encoding: 'application/json',
        body: { passwords },
      }
    },
  })
}
