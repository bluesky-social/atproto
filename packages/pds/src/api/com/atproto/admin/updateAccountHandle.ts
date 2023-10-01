import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { isServiceDomain, normalizeAndValidateHandle } from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger, mailerLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.updateAccountHandle({
    auth: ctx.roleVerifier,
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

      const { seqHandleTok, invalidated } = await ctx.db.transaction(
        async (dbTxn) => {
          const accountTxn = ctx.services.account(dbTxn)
          let seqHandleTok: HandleSequenceToken
          let invalidated: { did: string; handle: string } | null = null
          try {
            seqHandleTok = await accountTxn.updateHandle(did, handle)
          } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
              if (isServiceDomain(handle, ctx.cfg.availableUserDomains)) {
                throw new InvalidRequestError(`Handle already taken: ${handle}`)
              } else {
                invalidated = await accountTxn.invalidateHandle(handle)
                seqHandleTok = await accountTxn.updateHandle(did, handle)
              }
            } else {
              throw err
            }
          }
          await ctx.plcClient.updateHandle(did, ctx.plcRotationKey, handle)
          return { seqHandleTok, invalidated }
        },
      )

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

      if (invalidated) {
        try {
          const emailRes = await ctx.db.db
            .selectFrom('user_account')
            .where('did', '=', invalidated.did)
            .select('email')
            .executeTakeFirst()
          if (emailRes) {
            await ctx.mailer.sendInvalidatedHandle(invalidated, {
              to: emailRes.email,
            })
          }
        } catch (err) {
          mailerLogger.error(
            { err, invalidated },
            'error sending handle invalidation mail',
          )
        }
      }
    },
  })
}
