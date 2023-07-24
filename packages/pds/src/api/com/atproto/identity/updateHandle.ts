import { InvalidRequestError } from '@atproto/xrpc-server'
import { isServiceDomain, normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did: requester,
      })

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      const available = await ctx.services
        .account(ctx.db)
        .isHandleAvailable(handle)
      if (!available) {
        throw new InvalidRequestError(`Handle already taken: ${handle}`)
      }

      const seqHandleTok = await ctx.db.transaction(async (dbTxn) => {
        const accountTxn = ctx.services.account(dbTxn)
        let tok: HandleSequenceToken
        try {
          tok = await accountTxn.updateHandle(requester, handle)
        } catch (err) {
          if (err instanceof UserAlreadyExistsError) {
            if (isServiceDomain(handle, ctx.cfg.availableUserDomains)) {
              throw new InvalidRequestError(`Handle already taken: ${handle}`)
            } else {
              await accountTxn.invalidateHandle(handle)
              tok = await accountTxn.updateHandle(requester, handle)
            }
          } else {
            throw err
          }
        }
        await ctx.plcClient.updateHandle(requester, ctx.plcRotationKey, handle)
        return tok
      })

      try {
        await ctx.db.transaction(async (dbTxn) => {
          await ctx.services.account(dbTxn).sequenceHandle(seqHandleTok)
        })
      } catch (err) {
        httpLogger.error(
          { err, did: requester, handle },
          'failed to sequence handle update',
        )
      }

      ctx.contentReporter?.checkHandle({ handle, did: requester })
    },
  })
}
