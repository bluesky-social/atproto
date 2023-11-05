import { MINUTE } from '@atproto/common'
import { AuthRequiredError, UpstreamFailureError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { isThisPds } from '../../../proxy'
import * as sequencer from '../../../../sequencer'

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
        // in the background perform the hard account deletion work
        try {
          const recordService = ctx.services.record(db)
          const repoService = ctx.services.repo(db)
          const accountService = ctx.services.account(db)
          const account = await accountService.getAccount(did, true)
          const pdsDid = account?.pdsDid
          await recordService.deleteForActor(did)
          await repoService.deleteRepo(did)
          await accountService.deleteAccount(did)
          // propagate to pds behind entryway, or sequence tombstone on this pds
          if (ctx.cfg.service.isEntryway && pdsDid && !isThisPds(ctx, pdsDid)) {
            const pds = await accountService.getPds(pdsDid, { cached: true })
            if (!pds) {
              throw new UpstreamFailureError('unknown pds')
            }
            // both entryway and pds behind it need to clean-up account state.
            // the long flow is: pds(server.deleteAccount) -> entryway(server.deleteAccount) -> pds(admin.deleteAccount)
            const agent = ctx.pdsAgents.get(pds.host)
            await agent.com.atproto.admin.deleteAccount(
              { did },
              {
                encoding: 'application/json',
                headers: ctx.authVerifier.createAdminRoleHeaders(),
              },
            )
          } else {
            const seqEvt = await sequencer.formatSeqTombstone(did)
            await db.transaction(async (txn) => {
              await sequencer.sequenceEvt(txn, seqEvt)
            })
          }
        } catch (err) {
          req.log.error({ did, err }, 'account deletion failed')
        }
      })
    },
  })
}
