import jwt from 'jsonwebtoken'
import { AuthScopes } from '../../../auth'
import { ServerConfig } from '../../../config'
import AppContext from '../../../context'
import { User } from '../../../db/tables/user'
import { Server } from '../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.account.requestPasswordReset(async ({ input }) => {
    const email = input.body.email.toLowerCase()

    const user = await ctx.services.actor(ctx.db).getUserByEmail(email)

    if (user) {
      // By signing with the password hash, this jwt becomes invalid once the user changes their password.
      // This allows us to ensure it's essentially single-use (combined with the jwt's short-livedness).
      const token = jwt.sign(
        {
          sub: user.did,
          scope: AuthScopes.ResetPassword,
        },
        getSigningKey(user, ctx.cfg),
        { expiresIn: '15mins' },
      )

      await ctx.mailer.sendResetPassword({ token }, { to: user.email })
    }
  })

  server.com.atproto.account.resetPassword(async ({ input }) => {
    const { token, password } = input.body

    const tokenBody = jwt.decode(token)
    if (tokenBody === null || typeof tokenBody === 'string') {
      return createInvalidTokenError('Malformed token')
    }

    const { sub: did, scope } = tokenBody
    if (typeof did !== 'string' || scope !== AuthScopes.ResetPassword) {
      return createInvalidTokenError('Malformed token')
    }

    const user = await ctx.services.actor(ctx.db).getUser(did)
    if (!user) {
      return createInvalidTokenError('Token could not be verified')
    }

    try {
      jwt.verify(token, getSigningKey(user, ctx.cfg))
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return createExpiredTokenError()
      }
      return createInvalidTokenError('Token could not be verified')
    }

    // Token had correct scope, was not expired, and referenced
    // a user whose password has not changed since token issuance.

    await ctx.services.actor(ctx.db).updateUserPassword(user.handle, password)
  })
}

const getSigningKey = (user: User, config: ServerConfig) =>
  `${config.jwtSecret}::${user.password}`

type ErrorResponse = {
  status: number
  error: string
  message: string
}

const createInvalidTokenError = (
  message: string,
): ErrorResponse & { error: 'InvalidToken' } => ({
  status: 400,
  error: 'InvalidToken',
  message,
})

const createExpiredTokenError = (): ErrorResponse & {
  error: 'ExpiredToken'
} => ({
  status: 400,
  error: 'ExpiredToken',
  message: 'The password reset token has expired',
})
