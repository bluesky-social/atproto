import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AuthScopes } from '../../../auth'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { grantRefreshToken, revokeRefreshToken } from './util/auth'

export default function (server: Server) {
  server.com.atproto.getSession(async (_params, _input, req, res) => {
    const { db, auth } = locals.get(res)
    const did = auth.getUserDidOrThrow(req)
    const user = await db.getUser(did)
    if (!user) {
      throw new InvalidRequestError(
        `Could not find user info for account: ${did}`,
      )
    }
    return {
      encoding: 'application/json',
      body: { name: user.username, did: user.did },
    }
  })

  server.com.atproto.createSession(async (_params, input, _req, res) => {
    const { username, password } = input.body
    const { db, auth } = locals.get(res)
    const validPass = await db.verifyUserPassword(username, password)
    if (!validPass) {
      throw new AuthRequiredError('Invalid username or password')
    }

    const user = await db.getUser(username)
    if (!user) {
      throw new InvalidRequestError(
        `Could not find user info for account: ${username}`,
      )
    }

    const access = auth.createAccessToken(user.did)
    const refresh = auth.createRefreshToken(user.did)
    await grantRefreshToken(db, refresh.payload)

    return {
      encoding: 'application/json',
      body: {
        did: user.did,
        name: user.username,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      },
    }
  })

  server.com.atproto.refreshSession(async (_params, _input, req, res) => {
    const { db, auth } = locals.get(res)
    const did = auth.getUserDidOrThrow(req, AuthScopes.Refresh)
    const user = await db.getUser(did)
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
        throw new InvalidRequestError('Token has been revoked', 'ExpiredToken')
      }
      await grantRefreshToken(dbTxn, refresh.payload)
    })

    return {
      encoding: 'application/json',
      body: {
        did: user.did,
        name: user.username,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      },
    }
  })

  server.com.atproto.deleteSession(async (_params, _input, req, res) => {
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

    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
