import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountHandle({
    auth: ctx.roleVerifier,
    handler: async ({ input, req, auth }) => {
      if (!auth.credentials.admin) {
        throw new AuthRequiredError('Insufficient privileges')
      }
      const { did } = input.body
      let handle: string
      try {
        handle = ident.normalizeAndEnsureValidHandle(input.body.handle)
      } catch (err) {
        if (err instanceof ident.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else {
          throw err
        }
      }
      try {
        ident.ensureHandleServiceConstraints(
          handle,
          ctx.cfg.availableUserDomains,
        )
      } catch (err) {
        if (err instanceof ident.UnsupportedDomainError) {
          throw new InvalidRequestError(
            'Unsupported domain',
            'UnsupportedDomain',
          )
        } else if (err instanceof ident.ReservedHandleError) {
          // we allow this
          req.log.info(
            { did, handle: input.body },
            'admin setting reserved handle',
          )
        } else {
          throw err
        }
      }
      const existingAccnt = await ctx.services.account(ctx.db).getAccount(did)
      if (!existingAccnt) {
        throw new InvalidRequestError(`Account not found: ${did}`)
      }

      const seqHandleTok = await ctx.db.transaction(async (dbTxn) => {
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
