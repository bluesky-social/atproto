import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { UserAlreadyExistsError } from '../../../../services/account'
import { resolveExternalHandle } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      let handle: string
      try {
        handle = ident.normalizeAndEnsureValidHandle(input.body.handle)
      } catch (err) {
        if (err instanceof ident.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        }
        throw err
      }

      // test against our service constraints
      // if not a supported domain, then we must check that the domain correctly links to the DID
      try {
        ident.ensureHandleServiceConstraints(
          handle,
          ctx.cfg.availableUserDomains,
        )
      } catch (err) {
        if (err instanceof ident.UnsupportedDomainError) {
          const did = await resolveExternalHandle(ctx.cfg.scheme, handle)
          if (did !== requester) {
            throw new InvalidRequestError(
              'External handle did not resolve to DID',
            )
          }
        } else if (err instanceof ident.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else if (err instanceof ident.ReservedHandleError) {
          throw new InvalidRequestError(err.message, 'HandleNotAvailable')
        } else {
          throw err
        }
      }

      await ctx.db.transaction(async (dbTxn) => {
        try {
          await ctx.services.account(dbTxn).updateHandle(requester, handle)
        } catch (err) {
          if (err instanceof UserAlreadyExistsError) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          }
          throw err
        }
        await ctx.plcClient.updateHandle(requester, ctx.plcRotationKey, handle)
      })
    },
  })
}
