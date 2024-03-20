import { InvalidRequestError } from '@atproto/xrpc-server'
import { DAY, MINUTE } from '@atproto/common'
import { normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { httpLogger } from '../../../../logger'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.authVerifier.accessCheckTakedown,
    rateLimit: [
      {
        durationMs: 5 * MINUTE,
        points: 10,
        calcKey: ({ auth }) => auth.credentials.did,
      },
      {
        durationMs: DAY,
        points: 50,
        calcKey: ({ auth }) => auth.credentials.did,
      },
    ],
    handler: async ({ auth, input, req }) => {
      const requester = auth.credentials.did

      if (ctx.entrywayAgent) {
        // the full flow is:
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        await ctx.entrywayAgent.com.atproto.identity.updateHandle(
          { did: requester, handle: input.body.handle },
          authPassthru(req, true),
        )
        return
      }

      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did: requester,
      })

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      const account = await ctx.accountManager.getAccount(handle, {
        includeDeactivated: true,
      })

      if (account) {
        if (account.did !== requester) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
      } else {
        await ctx.plcClient.updateHandle(requester, ctx.plcRotationKey, handle)
        await ctx.accountManager.updateHandle(requester, handle)
      }

      try {
        await ctx.sequencer.sequenceHandleUpdate(requester, handle)
        await ctx.sequencer.sequenceIdentityEvt(requester)
      } catch (err) {
        httpLogger.error(
          { err, did: requester, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
