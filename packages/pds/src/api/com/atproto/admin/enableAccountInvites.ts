import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.enableAccountInvites({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { account } = input.body
      await ctx.db.db
        .updateTable('user_account')
        .where('did', '=', account)
        .set({ invitesDisabled: 0 })
        .execute()
    },
  })
}
