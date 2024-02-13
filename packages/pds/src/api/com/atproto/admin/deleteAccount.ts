import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { isThisPds } from '../../../proxy'
import { retryHttp } from '../../../../util/retry'

const REASON_ACCT_DELETION_ADMIN = 'account_deletion_admin'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.deleteAccount({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth, req }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { did } = input.body
      const accountService = ctx.services.account(ctx.db)

      const account = await accountService.getAccount(did, true)
      if (!account) {
        throw new InvalidRequestError('account not found', 'AccountNotFound')
      }

      await ctx.db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        const currState = await moderationTxn.getRepoTakedownState(did)
        // Do not disturb an existing takedown, continue with account deletion
        if (currState?.takedown.applied !== true) {
          await moderationTxn.updateRepoTakedownState(did, {
            applied: true,
            ref: REASON_ACCT_DELETION_ADMIN,
          })
        }
      })

      const { pdsDid } = account
      if (ctx.cfg.service.isEntryway && pdsDid && !isThisPds(ctx, pdsDid)) {
        try {
          const pds = await accountService.getPds(pdsDid, { cached: true })
          if (!pds) {
            throw new UpstreamFailureError('unknown pds')
          }
          // both entryway and pds behind it need to clean-up account state, then pds sequences tombstone.
          const agent = ctx.pdsAgents.get(pds.host)
          await retryHttp(() =>
            agent.com.atproto.admin.deleteAccount(
              { did },
              {
                encoding: 'application/json',
                headers: ctx.authVerifier.createAdminRoleHeaders(),
              },
            ),
          )
        } catch (err) {
          req.log.error(
            { did, pdsDid, err },
            'account deletion failed on pds behind entryway',
          )
          throw err
        }
      }

      ctx.backgroundQueue.add(async (db) => {
        // in the background perform the hard account deletion work
        try {
          await ctx.services.record(db).deleteForActor(did)
          await ctx.services.repo(db).deleteRepo(did)
          await ctx.services.account(db).deleteAccount(did)
          if (!ctx.cfg.service.isEntryway || isThisPds(ctx, pdsDid)) {
            // if this is the user's pds sequence the tombstone, otherwise taken care of by their pds behind the entryway.
            await ctx.services.account(db).sequenceTombstone(did)
          }
        } catch (err) {
          req.log.error({ did, err }, 'account deletion failed')
        }
      })
    },
  })
}
