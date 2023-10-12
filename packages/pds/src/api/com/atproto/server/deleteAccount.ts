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
    handler: async ({ input }) => {
      const { did, password, token } = input.body
      const validPass = await ctx.services
        .account(ctx.db)
        .verifyAccountPassword(did, password)
      if (!validPass) {
        throw new AuthRequiredError('Invalid did or password')
      }

      const accountService = await ctx.services.account(ctx.db)
      await accountService.assertValidToken(did, 'delete_account', token)
      await accountService.updateAccountTakedownStatus(did, {
        applied: true,
        ref: REASON_ACCT_DELETION,
      })
      await Promise.all([
        accountService.deleteAccount(did),
        ctx.actorStore.destroy(did),
        await ctx.sequencer.deleteAllForUser(did),
      ])
      await ctx.sequencer.sequenceTombstone(did)
    },
  })
}
