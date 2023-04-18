import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.revokeAppPassword({
    auth: ctx.accessVerifier,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const { name } = input.body
      await ctx.db.transaction(async (dbTxn) => {
        await ctx.services.account(dbTxn).deleteAppPassword(requester, name)
        await ctx.services
          .auth(dbTxn)
          .revokeAppPasswordRefreshToken(requester, name)
      })
    },
  })
}
