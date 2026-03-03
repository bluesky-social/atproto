import { MINUTE } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AccountStatus } from '../../../account-manager/account-manager'
import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.server.deleteAccountWID({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    // Intentionally unauthenticated — same design as upstream com.atproto.server.deleteAccount.
    // The approvalToken is DID-bound, cryptographically random, single-use, 10-minute TTL.
    // It is only reachable via io.trustanchor.quicklogin.status, which requires the
    // sessionToken that was issued to the authenticated caller of requestAccountDeleteWID.
    handler: async ({ input, req }) => {
      const { did, token } = input.body

      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      // Mirrors the deletion sequence in com.atproto.server.deleteAccount.
      // Kept in a separate handler to avoid upstream merge conflicts.
      await ctx.accountManager.assertValidEmailToken(
        did,
        'delete_account',
        token,
      )

      req.log.info(
        { did },
        'WID account deletion confirmed — destroying account',
      )

      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      const accountSeq = await ctx.sequencer.sequenceAccountEvt(
        did,
        AccountStatus.Deleted,
      )
      await ctx.sequencer.deleteAllForUser(did, [accountSeq])
    },
  })
}
