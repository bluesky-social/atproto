import * as crypto from '@atproto/crypto'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as ui8 from 'uint8arrays'
import express from 'express'
import * as jwt from 'jsonwebtoken'
import AppContext from './context'
import { softDeleted } from './db/util'

const BEARER = 'Bearer '
const BASIC = 'Basic '

export type ServerAuthOpts = {
  jwtSecret: string
  adminPass: string
  moderatorPass?: string
  triagePass?: string
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
  private _moderatorPass?: string
  private _triagePass?: string

  constructor(opts: ServerAuthOpts) {
    this._secret = opts.jwtSecret
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
  }

  createAccessToken(opts: {
    did: string
    scope?: AuthScope
    expiresIn?: string | number
  }) {
    const { did, scope = AuthScope.Access, expiresIn = '120mins' } = opts
    const payload = {
      scope,
      sub: did,
    }
    return {
      payload: payload as AuthToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn,
        mutatePayload: true,
      }),
    }
  }

  createRefreshToken(opts: {
    did: string
    jti?: string
    expiresIn?: string | number
  }) {
    const { did, jti = getRefreshTokenId(), expiresIn = '90days' } = opts
    const payload = {
      scope: AuthScope.Refresh,
      sub: did,
      jti,
    }
    return {
      payload: payload as RefreshToken, // exp set by sign()
      jwt: jwt.sign(payload, this._secret, {
        expiresIn: expiresIn,
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
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    return creds
  }

  verifyUser(req: express.Request, did: string, scopes: AuthScope[]): boolean {
    const authorized = this.getCredentials(req, scopes)
    return authorized !== null && authorized.did === did
  }

  verifyRole(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = AuthStatus
    if (!parsed) {
      return { status: Missing, admin: false, moderator: false, triage: false }
    }
    const { username, password } = parsed
    if (username === 'admin' && password === this._triagePass) {
      return { status: Valid, admin: false, moderator: false, triage: true }
    }
    if (username === 'admin' && password === this._moderatorPass) {
      return { status: Valid, admin: false, moderator: true, triage: true }
    }
    if (username === 'admin' && password === this._adminPass) {
      return { status: Valid, admin: true, moderator: true, triage: true }
    }
    return { status: Invalid, admin: false, moderator: false, triage: false }
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
    parsed = ui8.toString(ui8.fromString(b64, 'base64pad'), 'utf8').split(':')
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
    const creds = auth.getCredentialsOrThrow(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
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

export const accessOrRoleVerifier = (auth: ServerAuth) => {
  const verifyAccess = accessVerifier(auth)
  const verifyRole = roleVerifier(auth)
  return async (ctx: { req: express.Request; res: express.Response }) => {
    // For non-admin tokens, we don't want to consider alternative verifiers and let it fail if it fails
    const isRoleAuthToken = ctx.req.headers.authorization?.startsWith(BASIC)
    if (isRoleAuthToken) {
      const result = await verifyRole(ctx)
      return {
        ...result,
        credentials: {
          type: 'role' as const,
          ...result.credentials,
        },
      }
    }
    const result = await verifyAccess(ctx)
    return {
      ...result,
      credentials: {
        type: 'access' as const,
        ...result.credentials,
      },
    }
  }
}

export const optionalAccessOrRoleVerifier = (auth: ServerAuth) => {
  const verifyAccess = accessVerifier(auth)
  return async (ctx: { req: express.Request; res: express.Response }) => {
    try {
      return await verifyAccess(ctx)
    } catch (err) {
      if (
        err instanceof AuthRequiredError &&
        err.customErrorName === 'AuthMissing'
      ) {
        // Missing access bearer, move onto admin basic auth
        const credentials = auth.verifyRole(ctx.req)
        if (credentials.status === AuthStatus.Missing) {
          // If both are missing, passthrough: this auth scheme is optional
          return { credentials: null }
        } else if (credentials.admin) {
          return { credentials }
        } else {
          throw new AuthRequiredError()
        }
      }
      throw err
    }
  }
}

export const isUserOrAdmin = (
  auth: {
    credentials: null | { admin: boolean } | { did: string }
  },
  did: string,
) => {
  if (!auth.credentials) {
    return false
  }
  if ('did' in auth.credentials) {
    return auth.credentials.did === did
  }
  return auth.credentials.admin
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

export const roleVerifier =
  (auth: ServerAuth) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const credentials = auth.verifyRole(ctx.req)
    if (credentials.status !== AuthStatus.Valid) {
      throw new AuthRequiredError()
    }
    return { credentials }
  }

export const getRefreshTokenId = () => {
  return ui8.toString(crypto.randomBytes(32), 'base64')
}

export enum AuthStatus {
  Valid,
  Invalid,
  Missing,
}
