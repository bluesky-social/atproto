import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import Database from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.resetPassword(async ({ input }) => {
    const { token, password } = input.body

    const tokenInfo = await ctx.db.db
      .selectFrom('user_account')
      .select(['did', 'passwordResetGrantedAt'])
      .where('passwordResetToken', '=', token)
      .executeTakeFirst()

    if (!tokenInfo?.passwordResetGrantedAt) {
      return createInvalidTokenError()
    }

    const now = new Date()
    const grantedAt = new Date(tokenInfo.passwordResetGrantedAt)
    const expiresAt = new Date(grantedAt.getTime() + 15 * minsToMs)

    if (now > expiresAt) {
      await unsetResetToken(ctx.db, tokenInfo.did)
      return createExpiredTokenError()
    }

    await ctx.db.transaction(async (dbTxn) => {
      await unsetResetToken(dbTxn, tokenInfo.did)
      await ctx.services
        .account(dbTxn)
        .updateUserPassword(tokenInfo.did, password)
    })
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

const unsetResetToken = async (db: Database, did: string) => {
  await db.db
    .updateTable('user_account')
    .where('did', '=', did)
    .set({
      passwordResetToken: null,
      passwordResetGrantedAt: null,
    })
    .execute()
}
