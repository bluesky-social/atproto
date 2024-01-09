import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.enableAccountInvites({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      if (!auth.credentials.moderator) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { account } = input.body
      await ctx.accountManager.setAccountInvitesDisabled(account, false)
    },
  })
}
