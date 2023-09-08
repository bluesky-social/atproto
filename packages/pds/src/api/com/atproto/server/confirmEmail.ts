import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.confirmEmail({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token } = input.body

      await ctx.services
        .account(ctx.db)
        .assertValidToken(did, 'confirm_email', token)

      await ctx.db.transaction(async (dbTxn) => {
        await ctx.services.account(dbTxn).deleteEmailToken(did, 'confirm_email')
        await dbTxn.db
          .updateTable('user_account')
          .set({ emailConfirmedAt: new Date().toISOString() })
          .where('did', '=', did)
          .execute()
      })
    },
  })
}
