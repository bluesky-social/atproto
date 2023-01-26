import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AuthScopes } from '../../../auth'
import AppContext from '../../../context'
import { softDeleted } from '../../../db/util'
import { Server } from '../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.session.get({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.actor(ctx.db).getUser(did)
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      return {
        encoding: 'application/json',
        body: { handle: user.handle, did: user.did },
      }
    },
  })

  server.com.atproto.session.create(async ({ input }) => {
    const { password, ...body } = input.body
    const identifier = (
      body.identifier ||
      (typeof body.handle === 'string' && body.handle) || // @TODO deprecated, see #493
      ''
    ).toLowerCase()
    const authService = ctx.services.auth(ctx.db)
    const actorService = ctx.services.actor(ctx.db)

    const user = identifier.includes('@')
      ? await actorService.getUserByEmail(identifier, true)
      : await actorService.getUser(identifier, true)

    if (!user) {
      throw new AuthRequiredError('Invalid identifier or password')
    }

    const validPass = await actorService.verifyUserPassword(
      user.handle,
      password,
    )

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

  server.com.atproto.session.refresh({
    auth: ctx.refreshVerifier,
    handler: async ({ req, auth }) => {
      const did = auth.credentials.did
      const user = await ctx.services.actor(ctx.db).getUser(did, true)
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }
      if (softDeleted(user)) {
        throw new AuthRequiredError(
          'Account has been taken down',
          'AccountTakedown',
        )
      }

      const lastRefreshId = ctx.auth.verifyToken(
        ctx.auth.getToken(req) ?? '',
      ).jti
      if (!lastRefreshId) {
        throw new Error('Unexpected missing refresh token id')
      }

      const access = ctx.auth.createAccessToken(user.did)
      const refresh = ctx.auth.createRefreshToken(user.did)

      await ctx.db.transaction(async (dbTxn) => {
        const authTxn = ctx.services.auth(dbTxn)
        const revoked = await authTxn.revokeRefreshToken(lastRefreshId)
        if (!revoked) {
          throw new InvalidRequestError(
            'Token has been revoked',
            'ExpiredToken',
          )
        }
        await authTxn.grantRefreshToken(refresh.payload)
      })

      return {
        encoding: 'application/json',
        body: {
          did: user.did,
          handle: user.handle,
          accessJwt: access.jwt,
          refreshJwt: refresh.jwt,
        },
      }
    },
  })

  server.com.atproto.session.delete(async ({ req }) => {
    const token = ctx.auth.getToken(req)
    if (!token) {
      throw new AuthRequiredError()
    }
    const refreshToken = ctx.auth.verifyToken(token, AuthScopes.Refresh, {
      ignoreExpiration: true,
    })
    if (!refreshToken.jti) {
      throw new Error('Unexpected missing refresh token id')
    }

    await ctx.services.auth(ctx.db).revokeRefreshToken(refreshToken.jti)
  })
}
