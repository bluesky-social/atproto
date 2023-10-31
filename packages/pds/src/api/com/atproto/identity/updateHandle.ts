import { InvalidRequestError, UpstreamFailureError } from '@atproto/xrpc-server'
import { DAY, MINUTE } from '@atproto/common'
import { normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger } from '../../../../logger'
import { isThisPds } from '../../../proxy'

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
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const pdsDid = auth.credentials.pdsDid
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

      if (ctx.cfg.service.isEntryway && !isThisPds(ctx, pdsDid)) {
        const pds =
          pdsDid &&
          (await ctx.services.account(ctx.db).getPds(pdsDid, { cached: true }))
        if (!pds) {
          throw new UpstreamFailureError('unknown pds')
        }
        // the pds emits the handle event on the firehose, but the entryway is responsible for updating the did doc.
        // the long flow is: pds(identity.updateHandle) -> entryway(identity.updateHandle) -> pds(admin.updateAccountHandle)
        const agent = ctx.pdsAgents.get(pds.host)
        await agent.com.atproto.admin.updateAccountHandle(
          {
            did: requester,
            handle: input.body.handle,
          },
          {
            encoding: 'application/json',
            headers: ctx.authVerifier.createAdminRoleHeaders(),
          },
        )
        return // do not sequence handle event on the entryway
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
