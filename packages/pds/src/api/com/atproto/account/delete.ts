import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import Database from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.account.delete(async ({ input }) => {
    const { password, token } = input.body
    const handle = input.body.handle.toLowerCase()
    const validPass = await ctx.services
      .actor(ctx.db)
      .verifyUserPassword(handle, password)
    if (!validPass) {
      throw new AuthRequiredError('Invalid handle or password')
    }

    const tokenInfo = await ctx.db.db
      .selectFrom('did_handle')
      .innerJoin('delete_account_token as token', 'token.did', 'did_handle.did')
      .where('did_handle.handle', '=', handle)
      .where('token.token', '=', token)
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
      await removeDeleteToken(dbTxn, tokenInfo.did)
      // await ctx.services
      //   .actor(dbTxn)
      //   .updateUserPassword(tokenInfo.handle, password)
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

const removeDeleteToken = async (db: Database, did: string) => {
  await db.db
    .deleteFrom('delete_account_token')
    .where('delete_account_token.did', '=', did)
    .execute()
}
