import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCodes } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCodes({
    auth: ctx.adminVerifier,
    handler: async ({ input, req }) => {
      const { codeCount, useCount, forAccount = 'admin' } = input.body

      const codes = genInvCodes(ctx.cfg, codeCount)

      const vals = codes.map((code) => ({
        code: code,
        availableUses: useCount,
        disabled: 0 as const,
        forUser: forAccount,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
      }))

      await ctx.db.db.insertInto('invite_code').values(vals).execute()

      req.log.info(
        { useCount, codes, forAccount, codeCount },
        'created invite codes',
      )

      return {
        encoding: 'application/json',
        body: { codes },
      }
    },
  })
}
