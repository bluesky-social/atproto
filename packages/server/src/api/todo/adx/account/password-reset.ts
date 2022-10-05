import jwt from 'jsonwebtoken'
import { User } from '../../../../db/user'
import { Server } from '../../../../lexicon'
import * as util from '../../../../util'

const PASSWORD_RESET_SCOPE = 'todo.adx.resetAccountPassword'

export default function (server: Server) {
  server.todo.adx.requestAccountPasswordReset(
    async (_params, input, _req, res) => {
      const { db, config } = util.getLocals(res)
      const { email } = input.body

      // @TODO should multiple users be able to have the same email?
      const table = db.db.getRepository(User)
      const users = await table.findBy({ email })

      for (const user of users) {
        // By signing with the password hash, this jwt becomes invalid once the user changes their password.
        // This allows us to ensure it's essentially single-use (combined with the jwt's short-livedness).
        const signingKey = `${config.jwtSecret}::${user.password}`
        const token = jwt.sign(
          {
            sub: user.did,
            scope: PASSWORD_RESET_SCOPE,
          },
          signingKey,
          { expiresIn: '15mins' },
        )
        // @TODO mail it!
        console.log({ token, email: user.email })
      }

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  )

  server.todo.adx.resetAccountPassword(() => {
    // @TODO
    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
