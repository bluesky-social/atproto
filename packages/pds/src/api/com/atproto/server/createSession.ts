import { AuthRequiredError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'
import { AuthScope } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createSession(async ({ req, input }) => {
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

    const canLogin = await actorService.checkLoginAttempt(user)
    if (!canLogin) {
      req.log.warn(
        { did: user.did, attempts: user.loginAttemptCount },
        'too many login attempts',
      )
      throw new AuthRequiredError(
        'Too many login attempts, please wait a minute then try again',
      )
    }

    let appPasswordName: string | null = null
    const validAccountPass = await actorService.verifyAccountPassword(
      user.did,
      password,
    )
    if (!validAccountPass) {
      appPasswordName = await actorService.verifyAppPassword(user.did, password)
      if (appPasswordName === null) {
        await actorService.failedLoginAttempt(user.did)
        throw new AuthRequiredError('Invalid identifier or password')
      }
    }

    await actorService.successfulLoginAttempt(user.did)

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
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      },
    }
  })
}
