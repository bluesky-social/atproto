import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableInviteCodes({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { codes = [], accounts = [] } = input.body
      if (accounts.includes('admin')) {
        throw new InvalidRequestError('cannot disable admin invite codes')
      }
      await ctx.accountManager.disableInviteCodes({ codes, accounts })
    },
  })
}
