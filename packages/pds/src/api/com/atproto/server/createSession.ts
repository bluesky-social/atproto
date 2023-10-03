import { AuthRequiredError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { AuthScope } from '../../../../auth'
import { DAY, MINUTE } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createSession({
    rateLimit: [
      {
        durationMs: DAY,
        points: 300,
        calcKey: ({ input, req }) => `${input.body.identifier}-${req.ip}`,
      },
      {
        durationMs: 5 * MINUTE,
        points: 30,
        calcKey: ({ input, req }) => `${input.body.identifier}-${req.ip}`,
      },
    ],
    handler: async ({ input }) => {
      const { password } = input.body
      const identifier = input.body.identifier.toLowerCase()
      const authService = ctx.services.auth(ctx.db)
      const actorService = ctx.services.account(ctx.db)

      const user = identifier.includes('@')
        ? await actorService.getAccountByEmail(identifier, true)
        : await actorService.getAccount(identifier, true)

      if (!user) {
        throw new AuthRequiredError('Invalid identifier or password')
      }

      let appPasswordName: string | null = null
      const validAccountPass = await actorService.verifyAccountPassword(
        user.did,
        password,
      )
      if (!validAccountPass) {
        appPasswordName = await actorService.verifyAppPassword(
          user.did,
          password,
        )
        if (appPasswordName === null) {
          throw new AuthRequiredError('Invalid identifier or password')
        }
      }

      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const access = ctx.auth.createAccessToken({
        did: user.did,
        scope: appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
      })
      const refresh = ctx.auth.createRefreshToken({ did: user.did })
      await authService.grantRefreshToken(refresh.payload, appPasswordName)

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          handle: user.handle,
          email: user.email,
          emailConfirmed: !!user.emailConfirmedAt,
          accessJwt: access.jwt,
          refreshJwt: refresh.jwt,
        },
      }
    },
  })
}
