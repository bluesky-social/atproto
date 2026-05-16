import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { formatAccountInfo } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.searchAccounts, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      const { email, cursor, limit = 50 } = params
      const accounts = await ctx.accountManager.searchAccounts(
        { email, cursor, limit },
        { includeDeactivated: true, includeTakenDown: true },
      )

      const dids = accounts.map((a) => a.did)
      const [invites, invitedBy] = await Promise.all([
        ctx.accountManager.getAccountsInvitesCodes(dids),
        ctx.accountManager.getInvitedByForAccounts(dids),
      ])

      const managesOwnInvites = !ctx.cfg.entryway
      const accountViews = accounts.map((account) =>
        formatAccountInfo(account, { managesOwnInvites, invites, invitedBy }),
      )

      const nextCursor =
        accounts.length === limit
          ? accounts[accounts.length - 1].did
          : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: nextCursor,
          accounts: accountViews,
        },
      }
    },
  })
}
