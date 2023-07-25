import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  baseNormalizeAndValidate,
  isServiceDomain,
  normalizeAndValidateHandle,
} from '../../../../handle'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  HandleSequenceToken,
  UserAlreadyExistsError,
} from '../../../../services/account'
import { httpLogger, mailerLogger } from '../../../../logger'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.identity.updateHandle({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ auth, input }) => {
      const requester = auth.credentials.did
      const reqHandle = baseNormalizeAndValidate(input.body.handle)

      // Pessimistic check to handle spam: also enforced by updateHandle() and the db.
      if (isServiceDomain(reqHandle, ctx.cfg.availableUserDomains)) {
        const available = await ctx.services
          .account(ctx.db)
          .isHandleAvailable(reqHandle)
        if (!available) {
          throw new InvalidRequestError(`Handle already taken: ${reqHandle}`)
        }
      }

      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: reqHandle,
        did: requester,
      })

      const { seqHandleTok, invalidated } = await ctx.db.transaction(
        async (dbTxn) => {
          const accountTxn = ctx.services.account(dbTxn)
          let seqHandleTok: HandleSequenceToken
          let invalidated: { did: string; handle: string } | null = null
          try {
            seqHandleTok = await accountTxn.updateHandle(requester, handle)
          } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
              if (isServiceDomain(handle, ctx.cfg.availableUserDomains)) {
                throw new InvalidRequestError(`Handle already taken: ${handle}`)
              } else {
                invalidated = await accountTxn.invalidateHandle(handle)
                seqHandleTok = await accountTxn.updateHandle(requester, handle)
              }
            } else {
              throw err
            }
          }
          await ctx.plcClient.updateHandle(
            requester,
            ctx.plcRotationKey,
            handle,
          )
          return { seqHandleTok, invalidated }
        },
      )

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

      if (invalidated !== null) {
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

      ctx.contentReporter?.checkHandle({ handle, did: requester })
    },
  })
}
