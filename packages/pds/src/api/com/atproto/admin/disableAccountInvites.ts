import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.accessOrModerator,
    handler: async ({ input, auth, req }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      if (auth.credentials.type === 'access') {
        await ctx.moderationAgent.api.com.atproto.admin.disableAccountInvites(
          input.body,
          {
            ...(await ctx.moderationAuthHeaders(auth.credentials.did, req)),
            encoding: 'application/json',
          },
        )
        return
      }

      const { account } = input.body
      await ctx.accountManager.setAccountInvitesDisabled(account, true)
    },
  })
}
