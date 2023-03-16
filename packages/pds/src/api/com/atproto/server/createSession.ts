import { AuthRequiredError } from '@atproto/xrpc-server'
import AppContext from '../../../../context'
import { softDeleted } from '../../../../db/util'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createSession(async ({ input }) => {
    const { password, ...body } = input.body
    const identifier = (
      body.identifier ||
      (typeof body.handle === 'string' && body.handle) || // @TODO deprecated, see #493
      ''
    ).toLowerCase()
    const authService = ctx.services.auth(ctx.db)
    const actorService = ctx.services.account(ctx.db)

    const user = identifier.includes('@')
      ? await actorService.getAccountByEmail(identifier, true)
      : await actorService.getAccount(identifier, true)

    if (!user) {
      throw new AuthRequiredError('Invalid identifier or password')
    }

    const validPass = await actorService.verifyUserPassword(user.did, password)

    if (!validPass) {
      throw new AuthRequiredError('Invalid identifier or password')
    }

    if (softDeleted(user)) {
      throw new AuthRequiredError(
        'Account has been taken down',
        'AccountTakedown',
      )
    }

    const access = ctx.auth.createAccessToken(user.did)
    const refresh = ctx.auth.createRefreshToken(user.did)
    await authService.grantRefreshToken(refresh.payload)

    return {
      encoding: 'application/json',
      body: {
        did: user.did,
        handle: user.handle,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      },
    }
  })
}
