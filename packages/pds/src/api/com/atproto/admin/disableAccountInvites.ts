import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { account } = input.body
      await ctx.db.db
        .updateTable('user_account')
        .where('did', '=', account)
        .set({ invitesDisabled: 1 })
        .execute()
    },
  })
}
