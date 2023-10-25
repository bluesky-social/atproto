import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ensureValidAdminAud } from '../../../../auth-verifier'
import { INVALID_HANDLE } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getAccountInfo({
    auth: ctx.authVerifier.roleOrAdminService,
    handler: async ({ params, auth }) => {
      // any admin role auth can get account info, but verify aud on service jwt
      ensureValidAdminAud(auth, params.did)
      const [account, invites, invitedBy] = await Promise.all([
        ctx.accountManager.getAccount(params.did, true),
        ctx.accountManager.getAccountInvitesCodes(params.did),
        ctx.accountManager.getInvitedByForAccounts([params.did]),
      ])
      if (!account) {
        throw new InvalidRequestError('Account not found', 'NotFound')
      }
      return {
        encoding: 'application/json',
        body: {
          did: account.did,
          handle: account.handle ?? INVALID_HANDLE,
          email: account.email,
          indexedAt: account.createdAt,
          invitedBy: invitedBy[params.did],
          invites,
          invitesDisabled: account.invitesDisabled === 1,
        },
      }
    },
  })
}
