import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input }) => {
      const { did, password, token } = input.body
      const validPass = await ctx.accountManager.verifyAccountPassword(
        did,
        password,
      )
      if (!validPass) {
        throw new AuthRequiredError('Invalid did or password')
      }

      await ctx.accountManager.assertValidEmailToken(
        did,
        'delete_account',
        token,
      )
      await ctx.actorStore.destroy(did)
      await ctx.accountManager.deleteAccount(did)
      await ctx.sequencer.sequenceTombstone(did)
      await ctx.sequencer.deleteAllForUser(did)
    },
  })
}
