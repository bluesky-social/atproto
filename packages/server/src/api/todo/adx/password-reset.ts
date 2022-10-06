import jwt from 'jsonwebtoken'
import { ServerConfig } from '../../../config'
import { User } from '../../../db/user'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'

const PASSWORD_RESET_SCOPE = 'todo.adx.resetAccountPassword'

export default function (server: Server) {
  server.todo.adx.requestAccountPasswordReset(
    async (_params, input, _req, res) => {
      const { db, mailer, config } = locals.get(res)
      const { email } = input.body

      // @TODO should multiple users be able to have the same email?
      const table = db.db.getRepository(User)
      const user = await table.findOneBy({ email })

      if (user) {
        // By signing with the password hash, this jwt becomes invalid once the user changes their password.
        // This allows us to ensure it's essentially single-use (combined with the jwt's short-livedness).
        const token = jwt.sign(
          {
            sub: user.did,
            scope: PASSWORD_RESET_SCOPE,
          },
          getSigningKey(user, config),
          { expiresIn: '15mins' },
        )

        await mailer.sendResetPassword({ token }, { to: user.email })
      }

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  )

  server.todo.adx.resetAccountPassword(async (_params, input, _req, res) => {
    const { db, config } = locals.get(res)
    const { token, password } = input.body

    const tokenBody = jwt.decode(token)
    if (tokenBody === null || typeof tokenBody === 'string') {
      return createInvalidTokenError('Malformed token')
    }

    const { sub: did, scope } = tokenBody
    if (typeof did !== 'string' || scope !== PASSWORD_RESET_SCOPE) {
      return createInvalidTokenError('Malformed token')
    }

    const table = db.db.getRepository(User)
    const user = await table.findOneBy({ did })
    if (!user) {
      return createInvalidTokenError('Token could not be verified')
    }

    try {
      jwt.verify(token, getSigningKey(user, config))
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return createExpiredTokenError()
      }
      return createInvalidTokenError('Token could not be verified')
    }

    // Token had correct scope, was not expired, and referenced
    // a user whose password has not changed since token issuance.

    await db.updateUserPassword(did, password)

    return {
      encoding: 'application/json',
      body: {},
    }
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
