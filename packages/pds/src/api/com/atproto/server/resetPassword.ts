import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import { MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.resetPassword({
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 50,
      },
    ],
    handler: async ({ input }) => {
      const { token, password } = input.body

      const did = await ctx.services
        .account(ctx.db)
        .assertValidTokenAndFindDid('reset_password', token)

      await ctx.db.transaction(async (dbTxn) => {
        const accountService = ctx.services.account(ctx.db)
        await accountService.updateUserPassword(did, password)
        await accountService.deleteEmailToken(did, 'reset_password')
        await ctx.services.auth(dbTxn).revokeRefreshTokensByDid(did)
      })
    },
  })
}
