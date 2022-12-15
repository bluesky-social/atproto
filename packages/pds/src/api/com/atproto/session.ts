import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import ServerAuth, { AuthScopes } from '../../../auth'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { grantRefreshToken, revokeRefreshToken } from './util/auth'

export default function (server: Server) {
  server.com.atproto.session.get({
    auth: ServerAuth.verifier,
    handler: async ({ auth, res }) => {
      const { db, services } = locals.get(res)
      const did = auth.credentials.did
      const user = await services.actor(db).getUser(did)
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

  server.com.atproto.session.create(async ({ input, res }) => {
    const { password } = input.body
    const handle = input.body.handle.toLowerCase()
    const { db, services, auth } = locals.get(res)
    const validPass = await services
      .actor(db)
      .verifyUserPassword(handle, password)
    if (!validPass) {
      throw new AuthRequiredError('Invalid handle or password')
    }

    const user = await services.actor(db).getUser(handle)
    if (!user) {
      throw new InvalidRequestError(
        `Could not find user info for account: ${handle}`,
      )
    }

    const access = auth.createAccessToken(user.did)
    const refresh = auth.createRefreshToken(user.did)
    await grantRefreshToken(db, refresh.payload)

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
    auth: ServerAuth.refreshVerifier,
    handler: async ({ req, res, ...ctx }) => {
      const { db, services, auth } = locals.get(res)
      const did = ctx.auth.credentials.did
      const user = await services.actor(db).getUser(did)
      if (!user) {
        throw new InvalidRequestError(
          `Could not find user info for account: ${did}`,
        )
      }

      const lastRefreshId = auth.verifyToken(auth.getToken(req) ?? '').jti
      if (!lastRefreshId) {
        throw new Error('Unexpected missing refresh token id')
      }

      const access = auth.createAccessToken(user.did)
      const refresh = auth.createRefreshToken(user.did)

      await db.transaction(async (dbTxn) => {
        const revoked = await revokeRefreshToken(dbTxn, lastRefreshId)
        if (!revoked) {
          throw new InvalidRequestError(
            'Token has been revoked',
            'ExpiredToken',
          )
        }
        await grantRefreshToken(dbTxn, refresh.payload)
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

  server.com.atproto.session.delete(async ({ req, res }) => {
    const { db, auth } = locals.get(res)
    const token = auth.getToken(req)
    if (!token) {
      throw new AuthRequiredError()
    }
    const refreshToken = auth.verifyToken(token, AuthScopes.Refresh, {
      ignoreExpiration: true,
    })
    if (!refreshToken.jti) {
      throw new Error('Unexpected missing refresh token id')
    }

    await revokeRefreshToken(db, refreshToken.jti)
  })
}
