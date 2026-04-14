import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'
import { formatAccountInfo } from './util'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.admin.getAccountInfos, {
    auth: ctx.authVerifier.moderator,
    handler: async ({ params }) => {
      const [accounts, invites, invitedBy] = await Promise.all([
        ctx.accountManager.getAccounts(params.dids, {
          includeDeactivated: true,
          includeTakenDown: true,
        }),
        ctx.accountManager.getAccountsInvitesCodes(params.dids),
        ctx.accountManager.getInvitedByForAccounts(params.dids),
      ])

      const managesOwnInvites = !ctx.cfg.entryway
      const infos = Array.from(accounts.values()).map((account) => {
        return formatAccountInfo(account, {
          managesOwnInvites,
          invitedBy,
          invites,
        })
      })

      return {
        encoding: 'application/json' as const,
        body: { infos },
      }
    },
  })
}
