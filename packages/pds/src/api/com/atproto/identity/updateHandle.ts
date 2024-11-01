import assert from 'node:assert'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { DAY, MINUTE } from '@atproto/common'
import { normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { httpLogger } from '../../../../logger'
import { ids } from '../../../../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.authVerifier.accessStandard({ checkTakedown: true }),
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
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did

      if (ctx.entrywayAgent) {
        assert(ctx.cfg.entryway)

        // the full flow is:
        // -> entryway(identity.updateHandle) [update handle, submit plc op]
        // -> pds(admin.updateAccountHandle)  [track handle, sequence handle update]
        await ctx.entrywayAgent.com.atproto.identity.updateHandle(
          { did: requester, handle: input.body.handle },
          await ctx.serviceAuthHeaders(
            auth.credentials.did,
            ctx.cfg.entryway.did,
            ids.ComAtprotoIdentityUpdateHandle,
          ),
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

      if (!account) {
        if (requester.startsWith('did:plc:')) {
          await ctx.plcClient.updateHandle(
            requester,
            ctx.plcRotationKey,
            handle,
          )
        } else {
          const resolved = await ctx.idResolver.did.resolveAtprotoData(
            requester,
            true,
          )
          if (resolved.handle !== handle) {
            throw new InvalidRequestError(
              'DID is not properly configured for handle',
            )
          }
        }
        await ctx.accountManager.updateHandle(requester, handle)
      } else {
        // if we found an account with matching handle, check if it is the same as requester
        // if so emit an identity event, otherwise error.
        if (account.did !== requester) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
      }

      try {
        await ctx.sequencer.sequenceHandleUpdate(requester, handle)
        await ctx.sequencer.sequenceIdentityEvt(requester, handle)
      } catch (err) {
        httpLogger.error(
          { err, did: requester, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
