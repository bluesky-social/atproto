import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCode } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCode({
    auth: ctx.adminVerifier,
    handler: async ({ input, req }) => {
      const { useCount, forAccount = 'admin' } = input.body

      const code = genInvCode(ctx.cfg)

      await ctx.db.db
        .insertInto('invite_code')
        .values({
          code: code,
          availableUses: useCount,
          disabled: 0,
          forUser: forAccount,
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
        })
        .execute()

      req.log.info({ useCount, code, forAccount }, 'created invite code')

      return {
        encoding: 'application/json',
        body: { code },
      }
    },
  })
}
