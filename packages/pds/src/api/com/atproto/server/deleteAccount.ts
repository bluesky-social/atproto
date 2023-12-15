import { MINUTE } from '@atproto/common'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input, req }) => {
      const { did, password, token } = input.body

      const account = await ctx.accountManager.getAccount(did, true)
      if (!account) {
        throw new InvalidRequestError('account not found')
      }

      if (ctx.entrywayAgent) {
        await ctx.entrywayAgent.com.atproto.server.deleteAccount(
          input.body,
          authPassthru(req, true),
        )
        return
      }

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
