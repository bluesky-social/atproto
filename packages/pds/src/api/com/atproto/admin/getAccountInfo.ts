import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfo({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params }) => {
      const [account, invites, invitedBy] = await Promise.all([
        ctx.accountManager.getAccount(params.did, {
          includeDeactivated: true,
          includeTakenDown: true,
        }),
        ctx.accountManager.getAccountInvitesCodes(params.did),
        ctx.accountManager.getInvitedByForAccounts([params.did]),
      ])
      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }
      const managesOwnInvites = !ctx.cfg.entryway
      return {
        encoding: 'application/json',
        body: {
          did: account.did,
          handle: account.handle ?? INVALID_HANDLE,
          email: account.email ?? undefined,
          indexedAt: account.createdAt,
          emailConfirmedAt: account.emailConfirmedAt ?? undefined,
          invitedBy: managesOwnInvites ? invitedBy[params.did] : undefined,
          invites: managesOwnInvites ? invites : undefined,
          invitesDisabled: managesOwnInvites
            ? account.invitesDisabled === 1
            : undefined,
        },
      }
    },
  })
}
