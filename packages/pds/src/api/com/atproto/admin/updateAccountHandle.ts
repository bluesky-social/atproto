import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { httpLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountHandle({
    auth: ctx.authVerifier.role,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { did } = input.body
      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did,
        allowReserved: true,
      })

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      const account = await ctx.accountManager.getAccount(handle)

      if (account) {
        if (account.did !== did) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
      } else {
        await ctx.plcClient.updateHandle(did, ctx.plcRotationKey, handle)
        await ctx.accountManager.updateHandle(did, handle)
      }

      try {
        await ctx.sequencer.sequenceHandleUpdate(did, handle)
      } catch (err) {
        httpLogger.error(
          { err, did, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
