import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.updateEmail({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }
      // require valid token
      // @TODO re-enable updating non-verified emails
      // if (user.emailConfirmedAt) {
      if (!token) {
        throw new InvalidRequestError(
          'confirmation token required',
          'TokenRequired',
        )
      }
      await ctx.services
        .account(ctx.db)
        .assertValidToken(did, 'update_email', token)

      await ctx.db.transaction(async (dbTxn) => {
        const accntSrvce = ctx.services.account(dbTxn)

        if (token) {
          await accntSrvce.deleteEmailToken(did, 'update_email')
        }
        if (user.email !== email) {
          await accntSrvce.updateEmail(did, email)
        }
      })
    },
  })
}
