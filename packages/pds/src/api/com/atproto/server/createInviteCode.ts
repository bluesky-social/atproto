import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
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
