import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.enableAccountInvites({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      const { account } = input.body
      await ctx.accountManager.setAccountInvitesDisabled(account, false)
    },
  })
}
