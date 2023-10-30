import {
  AuthRequiredError,
  InvalidRequestError,
  UpstreamFailureError,
} from '@atproto/xrpc-server'
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

      const existingAccnt = await ctx.services.account(ctx.db).getAccount(did)
      if (!existingAccnt) {
        throw new InvalidRequestError(`Account not found: ${did}`)
      }

      let seqHandleTok: HandleSequenceToken
      if (existingAccnt.handle === handle) {
        seqHandleTok = { handle, did }
      } else {
        seqHandleTok = await ctx.db.transaction(async (dbTxn) => {
          let tok: HandleSequenceToken
          try {
            tok = await ctx.services.account(dbTxn).updateHandle(did, handle)
          } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
              throw new InvalidRequestError(`Handle already taken: ${handle}`)
            }
            throw err
          }
          await ctx.plcClient.updateHandle(did, ctx.plcRotationKey, handle)
          return tok
        })
      }

      const { pdsDid } = existingAccnt
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
            did,
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
          { err, did, handle },
          'failed to sequence handle update',
        )
      }
    },
  })
}
