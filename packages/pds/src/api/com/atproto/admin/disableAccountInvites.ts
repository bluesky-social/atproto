import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.disableAccountInvites, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      const { account } = input.body
      await ctx.accountManager.setAccountInvitesDisabled(account, true)
    },
  })
}
