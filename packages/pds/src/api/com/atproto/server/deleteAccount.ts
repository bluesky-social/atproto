import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import { TAKEDOWN } from '../../../../lexicon/types/com/atproto/admin/defs'
import AppContext from '../../../../context'
import Database from '../../../../db'
import { MINUTE } from '@atproto/common'

const REASON_ACCT_DELETION = 'ACCOUNT DELETION'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.deleteAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 50,
    },
    handler: async ({ input, req }) => {
      const { did, password, token } = input.body
      const validPass = await ctx.services
        .account(ctx.db)
        .verifyAccountPassword(did, password)
      if (!validPass) {
        throw new AuthRequiredError('Invalid did or password')
      }

      const tokenInfo = await ctx.db.db
        .selectFrom('did_handle')
        .innerJoin(
          'delete_account_token as token',
          'token.did',
          'did_handle.did',
        )
        .where('did_handle.did', '=', did)
        .where('token.token', '=', token.toUpperCase())
        .select([
          'token.token as token',
          'token.requestedAt as requestedAt',
          'token.did as did',
        ])
        .executeTakeFirst()

      if (!tokenInfo) {
        return createInvalidTokenError()
      }

      const now = new Date()
      const requestedAt = new Date(tokenInfo.requestedAt)
      const expiresAt = new Date(requestedAt.getTime() + 15 * minsToMs)
      if (now > expiresAt) {
        await removeDeleteToken(ctx.db, tokenInfo.did)
        return createExpiredTokenError()
      }

      await ctx.db.transaction(async (dbTxn) => {
        const moderationTxn = ctx.services.moderation(dbTxn)
        const [currentAction] = await moderationTxn.getCurrentActions({ did })
        if (currentAction?.action === TAKEDOWN) {
          // Do not disturb an existing takedown, continue with account deletion
          return await removeDeleteToken(dbTxn, did)
        }
        if (currentAction) {
          // Reverse existing action to replace it with a self-takedown
          await moderationTxn.logReverseAction({
            id: currentAction.id,
            reason: REASON_ACCT_DELETION,
            createdBy: did,
            createdAt: now,
          })
        }
        const takedown = await moderationTxn.logAction({
          action: TAKEDOWN,
          subject: { did },
          reason: REASON_ACCT_DELETION,
          createdBy: did,
          createdAt: now,
        })
        await moderationTxn.takedownRepo({ did, takedownId: takedown.id })
        await removeDeleteToken(dbTxn, did)
      })

      ctx.backgroundQueue.add(async (db) => {
        try {
          // In the background perform the hard account deletion work
          await ctx.services.record(db).deleteForActor(did)
          await ctx.services.repo(db).deleteRepo(did)
          await ctx.services.account(db).deleteAccount(did)
        } catch (err) {
          req.log.error({ did, err }, 'account deletion failed')
        }
      })
    },
  })
}

type ErrorResponse = {
  status: number
  error: string
  message: string
}

const minsToMs = 60 * 1000

const createInvalidTokenError = (): ErrorResponse & {
  error: 'InvalidToken'
} => ({
  status: 400,
  error: 'InvalidToken',
  message: 'Token is invalid',
})

const createExpiredTokenError = (): ErrorResponse & {
  error: 'ExpiredToken'
} => ({
  status: 400,
  error: 'ExpiredToken',
  message: 'The password reset token has expired',
})

const removeDeleteToken = async (db: Database, did: string) => {
  await db.db
    .deleteFrom('delete_account_token')
    .where('delete_account_token.did', '=', did)
    .execute()
}
