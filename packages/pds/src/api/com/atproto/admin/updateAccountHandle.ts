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
      const account = await ctx.accountManager.getAccount(handle, {
        includeDeactivated: true,
        includeTakenDown: true,
      })

      if (account) {
        if (account.did !== did) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
      } else {
        if (ctx.cfg.entryway) {
          // the pds defers to the entryway for updating the handle in the user's did doc.
          // here was just check that the handle is already bidirectionally confirmed.
          // @TODO if handle is taken according to this PDS, should we force-update?
          const doc = await ctx.idResolver.did
            .resolveAtprotoData(did, true)
            .catch(() => undefined)
          if (doc?.handle !== handle) {
            throw new InvalidRequestError('Handle does not match DID doc')
          }
        } else {
          await ctx.plcClient.updateHandle(did, ctx.plcRotationKey, handle)
        }
        await ctx.accountManager.updateHandle(did, handle)
      }

      try {
        await ctx.sequencer.sequenceHandleUpdate(did, handle)
        await ctx.sequencer.sequenceIdentityEvt(did)
      } catch (err) {
        httpLogger.error(
          { err, did, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
