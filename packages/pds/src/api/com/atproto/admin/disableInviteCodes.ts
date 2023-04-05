import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableInviteCodes({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
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
