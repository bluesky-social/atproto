import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import Database from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.account.resetPassword(async ({ input }) => {
    const { token, password } = input.body

    const tokenInfo = await ctx.db.db
      .selectFrom('user')
      .select(['handle', 'passwordResetGrantedAt'])
      .where('passwordResetToken', '=', token)
      .executeTakeFirst()

    if (!tokenInfo?.passwordResetGrantedAt) {
      return createInvalidTokenError()
    }

    const now = new Date()
    const grantedAt = new Date(tokenInfo.passwordResetGrantedAt)
    const expiresAt = new Date(grantedAt.getTime() + 15 * minsToMs)

    if (now > expiresAt) {
      await unsetResetToken(ctx.db, tokenInfo.handle)
      return createExpiredTokenError()
    }

    await ctx.db.transaction(async (dbTxn) => {
      await unsetResetToken(dbTxn, tokenInfo.handle)
      await ctx.services
        .actor(dbTxn)
        .updateUserPassword(tokenInfo.handle, password)
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

const unsetResetToken = async (db: Database, handle: string) => {
  await db.db
    .updateTable('user')
    .where('handle', '=', handle)
    .set({
      passwordResetToken: null,
      passwordResetGrantedAt: null,
    })
    .execute()
}
