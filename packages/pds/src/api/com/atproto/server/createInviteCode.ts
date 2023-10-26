import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { genInvCode } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCode({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
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
