import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { UserAlreadyExistsError } from '../../../../services/account'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountHandle({
    auth: ctx.adminVerifier,
    handler: async ({ input }) => {
      const { did } = input.body
      let handle: string
      try {
        handle = ident.normalizeAndEnsureValidHandle(input.body.handle)
        ident.ensureHandleServiceConstraints(
          handle,
          ctx.cfg.availableUserDomains,
        )
      } catch (err) {
        if (err instanceof ident.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else if (err instanceof ident.UnsupportedDomainError) {
          throw new InvalidRequestError(
            'Unsupported domain',
            'UnsupportedDomain',
          )
        } else if (err instanceof ident.ReservedHandleError) {
          throw new InvalidRequestError(err.message, 'HandleNotAvailable')
        } else {
          throw err
        }
      }
      const existingAccnt = await ctx.services.account(ctx.db).getAccount(did)
      if (!existingAccnt) {
        throw new InvalidRequestError(`Account not found: ${did}`)
      }
      const isServiceDomain = ctx.cfg.availableUserDomains.find((domain) =>
        existingAccnt.handle.endsWith(domain),
      )
      if (!isServiceDomain) {
        throw new InvalidRequestError(
          `Account not on an available service domain: ${existingAccnt.handle}`,
        )
      }

      await ctx.db.transaction(async (dbTxn) => {
        try {
          await ctx.services.account(dbTxn).updateHandle(did, handle)
        } catch (err) {
          if (err instanceof UserAlreadyExistsError) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          }
          throw err
        }
        await ctx.plcClient.updateHandle(did, ctx.plcRotationKey, handle)
      })
    },
  })
}
