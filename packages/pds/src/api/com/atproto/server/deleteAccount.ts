import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { TAKEDOWN } from '../../../../lexicon/types/com/atproto/admin/defs'
import AppContext from '../../../../context'
import { MINUTE } from '@atproto/common'

const REASON_ACCT_DELETION = 'ACCOUNT DELETION'

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

      const now = new Date()
      await ctx.db.transaction(async (dbTxn) => {
        const accountService = ctx.services.account(dbTxn)
        const moderationTxn = ctx.services.moderation(dbTxn)
        const [currentAction] = await moderationTxn.getCurrentActions({ did })
        if (currentAction?.action === TAKEDOWN) {
          // Do not disturb an existing takedown, continue with account deletion
          return await accountService.deleteEmailToken(did, 'delete_account')
        }
        if (currentAction) {
          // Reverse existing action to replace it with a self-takedown
          await moderationTxn.logReverseAction({
            id: currentAction.id,
            reason: REASON_ACCT_DELETION,
            createdBy: did,
            createdAt: now,
          })
        }
        const takedown = await moderationTxn.logAction({
          action: TAKEDOWN,
          subject: { did },
          reason: REASON_ACCT_DELETION,
          createdBy: did,
          createdAt: now,
        })
        await moderationTxn.takedownRepo({ did, takedownId: takedown.id })
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
