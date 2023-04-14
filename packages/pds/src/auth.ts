import * as crypto from '@atproto/crypto'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as uint8arrays from 'uint8arrays'
import express from 'express'
import * as jwt from 'jsonwebtoken'
import AppContext from './context'
import { softDeleted } from './db/util'

const BEARER = 'Bearer '
const BASIC = 'Basic '

export type ServerAuthOpts = {
  jwtSecret: string
  adminPass: string
}

// @TODO sync-up with current method names, consider backwards compat.
export enum AuthScope {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  AppPass = 'com.atproto.appPass',
}

export type AuthToken = {
  scope: AuthScope
  sub: string
  exp: number
}

export type RefreshToken = AuthToken & { jti: string }

export class ServerAuth {
  private _secret: string
  private _adminPass: string

  constructor(opts: ServerAuthOpts) {
    this._secret = opts.jwtSecret
    this._adminPass = opts.adminPass
  }

  createAccessToken(did: string, expiresIn?: string | number) {
    const payload = {
      scope: AuthScope.Access,
      sub: did,
    }
    return {
      payload: payload as AuthToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn ?? '120mins',
        mutatePayload: true,
      }),
    }
  }

  createRefreshToken(did: string, jti?: string, expiresIn?: string | number) {
    const payload = {
      scope: AuthScope.Refresh,
      sub: did,
      jti: jti ?? getRefreshTokenId(),
    }
    return {
      payload: payload as RefreshToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn ?? '90days',
        mutatePayload: true,
      }),
    }
  }

  getCredentials(
    req: express.Request,
    scopes = [AuthScope.Access],
  ): { did: string; scope: AuthScope } | null {
    const token = this.getToken(req)
    if (!token) return null
    const payload = this.verifyToken(token, scopes)
    const sub = payload.sub
    if (typeof sub !== 'string' || !sub.startsWith('did:')) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    return { did: sub, scope: payload.scope }
  }

  getCredentialsOrThrow(
    req: express.Request,
    scopes: AuthScope[],
  ): { did: string; scope: AuthScope } {
    const creds = this.getCredentials(req, scopes)
    if (creds === null) {
      throw new AuthRequiredError()
    }
    return creds
  }

  verifyUser(req: express.Request, did: string, scopes: AuthScope[]): boolean {
    const authorized = this.getCredentials(req, scopes)
    return authorized !== null && authorized.did === did
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

  verifyToken(
    token: string,
    scopes: AuthScope[],
    options?: jwt.VerifyOptions,
  ): jwt.JwtPayload {
    try {
      const payload = jwt.verify(token, this._secret, options)
      if (typeof payload === 'string' || 'signature' in payload) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }
      if (scopes.length > 0 && !scopes.includes(payload.scope)) {
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

export const accessVerifier =
  (auth: ServerAuth) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const creds = auth.getCredentialsOrThrow(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
    return {
      credentials: creds,
      artifacts: auth.getToken(ctx.req),
    }
  }

export const accessVerifierNotAppPassword =
  (auth: ServerAuth) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const creds = auth.getCredentialsOrThrow(ctx.req, [AuthScope.Access])
    return {
      credentials: creds,
      artifacts: auth.getToken(ctx.req),
    }
  }

export const accessVerifierCheckTakedown =
  (auth: ServerAuth, { db, services }: AppContext) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const creds = auth.getCredentialsOrThrow(ctx.req, [AuthScope.Access])
    const actor = await services.account(db).getAccount(creds.did, true)
    if (!actor || softDeleted(actor)) {
      throw new AuthRequiredError(
        'Account has been taken down',
        'AccountTakedown',
      )
    }
    return {
      credentials: creds,
      artifacts: auth.getToken(ctx.req),
    }
  }

export const refreshVerifier =
  (auth: ServerAuth) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const creds = auth.getCredentialsOrThrow(ctx.req, [AuthScope.Refresh])
    return {
      credentials: creds,
      artifacts: auth.getToken(ctx.req),
    }
  }

export const adminVerifier =
  (auth: ServerAuth) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const admin = auth.verifyAdmin(ctx.req)
    if (!admin) {
      throw new AuthRequiredError()
    }
    return { credentials: { admin } }
  }

export const getRefreshTokenId = () => {
  return uint8arrays.toString(crypto.randomBytes(32), 'base64')
}
