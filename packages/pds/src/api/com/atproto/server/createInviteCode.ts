import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { genInvCode } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCode({
    auth: ctx.authVerifier.adminToken,
    handler: async ({ input }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      const { useCount, forAccount = 'admin' } = input.body

      const code = genInvCode(ctx.cfg)

      await ctx.accountManager.createInviteCodes(
        [{ account: forAccount, codes: [code] }],
        useCount,
      )

      return {
        encoding: 'application/json',
        body: { code },
      }
    },
  })
}
