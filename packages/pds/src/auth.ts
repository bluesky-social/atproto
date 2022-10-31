import * as auth from '@atproto/auth'
import * as crypto from '@atproto/crypto'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as uint8arrays from 'uint8arrays'
import { DidResolver } from '@atproto/did-resolver'
import express from 'express'
import * as jwt from 'jsonwebtoken'

const BEARER = 'Bearer '
const BASIC = 'Basic '

export type ServerAuthOpts = {
  jwtSecret: string
  didResolver: DidResolver
  adminPass: string
}

export enum AuthScopes {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  ResetPassword = 'com.atproto.resetAccountPassword',
}

export type AuthToken = {
  scope: AuthScopes
  sub: string
  exp: number
}

export type RefreshToken = AuthToken & { jti: string }

export class ServerAuth {
  private _secret: string
  private _adminPass: string
  didResolver: DidResolver
  verifier: auth.Verifier

  constructor(opts: ServerAuthOpts) {
    this._secret = opts.jwtSecret
    this._adminPass = opts.adminPass
    this.didResolver = opts.didResolver
    this.verifier = new auth.Verifier({ didResolver: opts.didResolver })
  }

  createAccessToken(did: string, expiresIn?: string | number) {
    const payload = {
      scope: AuthScopes.Access,
      sub: did,
    }
    return {
      payload: payload as AuthToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn ?? '15mins',
        mutatePayload: true,
      }),
    }
  }

  createRefreshToken(did: string, expiresIn?: string | number) {
    const payload = {
      scope: AuthScopes.Refresh,
      sub: did,
      jti: uint8arrays.toString(crypto.randomBytes(32), 'base64'),
    }
    return {
      payload: payload as RefreshToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn ?? '7days',
        mutatePayload: true,
      }),
    }
  }

  getUserDid(req: express.Request, scope = AuthScopes.Access): string | null {
    const token = this.getToken(req)
    if (!token) return null
    const payload = this.verifyToken(token, scope)
    const sub = payload.sub
    if (typeof sub !== 'string' || !sub.startsWith('did:')) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    return sub
  }

  getUserDidOrThrow(req: express.Request, scope?: AuthScopes): string {
    const did = this.getUserDid(req, scope)
    if (did === null) {
      throw new AuthRequiredError()
    }
    return did
  }

  verifyUser(req: express.Request, did: string, scope?: AuthScopes): boolean {
    const authorized = this.getUserDid(req, scope)
    return authorized === did
  }

  verifyAdmin(req: express.Request): boolean {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    if (!parsed) return false
    const { username, password } = parsed
    if (username !== 'admin') return false
    if (password !== this._adminPass) return false
    return true
  }

  getToken(req: express.Request) {
    const header = req.headers.authorization || ''
    if (!header.startsWith(BEARER)) return null
    return header.slice(BEARER.length)
  }

  verifyToken(token: string, scope?: AuthScopes, options?: jwt.VerifyOptions) {
    try {
      const payload = jwt.verify(token, this._secret, options)
      if (typeof payload === 'string' || 'signature' in payload) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (scope && payload.scope !== scope) {
        throw new InvalidRequestError('Bad token scope', 'InvalidToken')
      }
      return payload
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new InvalidRequestError('Token has expired', 'ExpiredToken')
      }
      throw new InvalidRequestError(
        'Token could not be verified',
        'InvalidToken',
      )
    }
  }

  toString(): string {
    return 'Server auth: JWT'
  }
}

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  if (!token.startsWith(BASIC)) return null
  const b64 = token.slice(BASIC.length)
  let parsed: string[]
  try {
    parsed = uint8arrays
      .toString(uint8arrays.fromString(b64, 'base64pad'), 'utf8')
      .split(':')
  } catch (err) {
    return null
  }
  const [username, password] = parsed
  if (!username || !password) return null
  return { username, password }
}

export default ServerAuth
