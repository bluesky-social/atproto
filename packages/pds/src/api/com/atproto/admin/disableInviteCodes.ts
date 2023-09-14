import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableInviteCodes({
    auth: ctx.roleVerifier,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { codes = [], accounts = [] } = input.body
      if (accounts.includes('admin')) {
        throw new InvalidRequestError('cannot disable admin invite codes')
      }
      if (codes.length > 0) {
        await ctx.db.db
          .updateTable('invite_code')
          .set({ disabled: 1 })
          .where('code', 'in', codes)
          .execute()
      }
      if (accounts.length > 0) {
        await ctx.db.db
          .updateTable('invite_code')
          .set({ disabled: 1 })
          .where('forUser', 'in', accounts)
          .execute()
      }
    },
  })
}
