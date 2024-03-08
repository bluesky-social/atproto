import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableInviteCodes({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input }) => {
      if (ctx.cfg.entryway) {
        throw new InvalidRequestError(
          'Account invites are managed by the entryway service',
        )
      }
      const { codes = [], accounts = [] } = input.body
      if (accounts.includes('admin')) {
        throw new InvalidRequestError('cannot disable admin invite codes')
      }
      await ctx.accountManager.disableInviteCodes({ codes, accounts })
    },
  })
}
