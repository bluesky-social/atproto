import { InvalidRequestError } from '@atproto/xrpc-server'
import { normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger } from '../../../../logger'
import { DAY, MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.accessVerifierCheckTakedown,
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
      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did: requester,
      })

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      const handleDid = await ctx.services.account(ctx.db).getHandleDid(handle)

      let seqHandleTok: HandleSequenceToken
      if (handleDid) {
        if (handleDid !== requester) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
        seqHandleTok = { did: requester, handle: handle }
      } else {
        seqHandleTok = await ctx.db.transaction(async (dbTxn) => {
          let tok: HandleSequenceToken
          try {
            tok = await ctx.services
              .account(dbTxn)
              .updateHandle(requester, handle)
          } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
              throw new InvalidRequestError(`Handle already taken: ${handle}`)
            }
            throw err
          }
          await ctx.plcClient.updateHandle(
            requester,
            ctx.plcRotationKey,
            handle,
          )
          return tok
        })
      }

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
    },
  })
}
