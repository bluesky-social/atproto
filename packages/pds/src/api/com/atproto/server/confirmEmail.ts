import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.confirmEmail({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body

      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found', 'AccountNotFound')
      }

      if (user.email !== email.toLowerCase()) {
        throw new InvalidRequestError('invalid email', 'InvalidEmail')
      }
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
