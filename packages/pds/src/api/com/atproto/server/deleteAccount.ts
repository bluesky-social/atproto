import { MINUTE } from '@atproto/common'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'
import { AccountStatus } from '../../../../account-manager'
import { Hex } from 'viem'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input, req }) => {
      const { did, signature, token } = input.body

      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
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

      const validPass = await ctx.accountManager.verifySIWE(
        did,
        signature as Hex,
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
      const accountSeq = await ctx.sequencer.sequenceAccountEvt(
        did,
        AccountStatus.Deleted,
      )
      const tombstoneSeq = await ctx.sequencer.sequenceTombstone(did)
      await ctx.sequencer.deleteAllForUser(did, [accountSeq, tombstoneSeq])
    },
  })
}
