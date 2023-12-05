import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { account, note } = input.body
      await ctx.db.db
        .updateTable('user_account')
        .where('did', '=', account)
        .set({ invitesDisabled: 1, inviteNote: note?.trim() || null })
        .execute()
    },
  })
}
