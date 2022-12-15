import { randomStr } from '@atproto/crypto'
import Database from '../../../db'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.account.requestPasswordReset(async ({ input, res }) => {
    const { db, services, mailer } = locals.get(res)
    const email = input.body.email.toLowerCase()

    const user = await services.actor(db).getUserByEmail(email)

    if (user) {
      const token = getSixDigitToken()
      const grantedAt = new Date().toISOString()
      await db.db
        .updateTable('user')
        .where('handle', '=', user.handle)
        .set({
          passwordResetToken: token,
          passwordResetGrantedAt: grantedAt,
        })
        .execute()
      await mailer.sendResetPassword({ token }, { to: user.email })
    }
  })

  server.com.atproto.account.resetPassword(async ({ input, res }) => {
    const { db, services } = locals.get(res)
    const { token, password } = input.body

    const tokenInfo = await db.db
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
      await unsetResetToken(db, tokenInfo.handle)
      return createExpiredTokenError()
    }

    await db.transaction(async (dbTxn) => {
      await unsetResetToken(dbTxn, tokenInfo.handle)
      await services.actor(dbTxn).updateUserPassword(tokenInfo.handle, password)
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

const getSixDigitToken = () => randomStr(4, 'base10').slice(0, 6)

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
