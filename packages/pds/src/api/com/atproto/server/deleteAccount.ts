import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MINUTE } from '@atproto/common'

const REASON_ACCT_DELETION = 'account_deletion'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input, req }) => {
      const { did, password, token } = input.body
      const validPass = await ctx.services
        .account(ctx.db)
        .verifyAccountPassword(did, password)
      if (!validPass) {
        throw new AuthRequiredError('Invalid did or password')
      }

      await ctx.services
        .account(ctx.db)
        .assertValidToken(did, 'delete_account', token)

      await ctx.db.transaction(async (dbTxn) => {
        const accountService = ctx.services.account(dbTxn)
        const moderationTxn = ctx.services.moderation(dbTxn)
        const currState = await moderationTxn.getRepoTakedownState(did)
        // Do not disturb an existing takedown, continue with account deletion
        if (currState?.takedown.applied !== true) {
          await moderationTxn.updateRepoTakedownState(did, {
            applied: true,
            ref: REASON_ACCT_DELETION,
          })
        }
        await accountService.deleteEmailToken(did, 'delete_account')
      })

      ctx.backgroundQueue.add(async (db) => {
        try {
          // In the background perform the hard account deletion work
          await ctx.services.record(db).deleteForActor(did)
          await ctx.services.repo(db).deleteRepo(did)
          await ctx.services.account(db).deleteAccount(did)
        } catch (err) {
          req.log.error({ did, err }, 'account deletion failed')
        }
      })
    },
  })
}
