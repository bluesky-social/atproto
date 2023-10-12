import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import * as ui8 from 'uint8arrays'
import express from 'express'
import * as jwt from 'jsonwebtoken'
import Database from './db'

type ReqCtx = {
  req: express.Request
}

// @TODO sync-up with current method names, consider backwards compat.
export enum AuthScope {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  AppPass = 'com.atproto.appPass',
}

export enum RoleStatus {
  Valid,
  Invalid,
  Missing,
}

type NullOutput = {
  credentials: null
}

type RoleOutput = {
  credentials: {
    type: 'role'
    admin: boolean
    moderator: boolean
    triage: boolean
  }
}

type AccessOutput = {
  credentials: {
    type: 'access'
    did: string
    scope: AuthScope
  }
  artifacts: string
}

type RefreshOutput = {
  credentials: {
    type: 'refresh'
    did: string
    scope: AuthScope
    tokenId: string
  }
  artifacts: string
}

type ValidatedBearer = {
  did: string
  scope: AuthScope
  token: string
  payload: jwt.JwtPayload
}

export type AuthVerifierOpts = {
  jwtSecret: string
  adminPass: string
  moderatorPass: string
  triagePass: string
}

export class AuthVerifier {
  private _secret: string
  private _adminPass: string
  private _moderatorPass: string
  private _triagePass: string

  constructor(public db: Database, opts: AuthVerifierOpts) {
    this._secret = opts.jwtSecret
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
  }

  // verifiers (arrow fns to preserve scope)

  access = (ctx: ReqCtx): AccessOutput => {
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
  }

  accessCheckTakedown = async (ctx: ReqCtx): Promise<AccessOutput> => {
    const result = this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
    const found = await this.db.db
      .selectFrom('user_account')
      .innerJoin('repo_root', 'repo_root.did', 'user_account.did')
      .where('user_account.did', '=', result.credentials.did)
      .where('repo_root.takedownId', 'is', null)
      .select('user_account.did')
      .executeTakeFirst()
    if (!found) {
      throw new AuthRequiredError(
        'Account has been taken down',
        'AccountTakedown',
      )
    }
    return result
  }

  accessNotAppPassword = (ctx: ReqCtx): AccessOutput => {
    return this.validateAccessToken(ctx.req, [AuthScope.Access])
  }

  refresh = (ctx: ReqCtx): RefreshOutput => {
    const { did, scope, token, payload } = this.validateBearerToken(ctx.req, [
      AuthScope.Refresh,
    ])
    if (!payload.jti) {
      throw new AuthRequiredError(
        'Unexpected missing refresh token id',
        'MissingTokenId',
      )
    }
    return {
      credentials: {
        type: 'refresh',
        did,
        scope,
        tokenId: payload.jti,
      },
      artifacts: token,
    }
  }

  role = (ctx: ReqCtx): RoleOutput => {
    const creds = this.parseRoleCreds(ctx.req)
    if (creds.status !== RoleStatus.Valid) {
      throw new AuthRequiredError()
    }
    return {
      credentials: {
        ...creds,
        type: 'role',
      },
    }
  }

  accessOrRole = (ctx: ReqCtx): AccessOutput | RoleOutput => {
    if (isBearerToken(ctx.req)) {
      return this.access(ctx)
    } else {
      return this.role(ctx)
    }
  }

  optionalAccessOrRole = (
    ctx: ReqCtx,
  ): AccessOutput | RoleOutput | NullOutput => {
    if (isBearerToken(ctx.req)) {
      return this.access(ctx)
    } else {
      const creds = this.parseRoleCreds(ctx.req)
      if (creds.status === RoleStatus.Missing) {
        return { credentials: null }
      } else if (creds.admin) {
        return {
          credentials: {
            ...creds,
            type: 'role',
          },
        }
      } else {
        throw new AuthRequiredError()
      }
    }
  }

  validateBearerToken(
    req: express.Request,
    scopes: AuthScope[],
    options?: jwt.VerifyOptions,
  ): ValidatedBearer {
    const token = bearerTokenFromReq(req)
    if (!token) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    const payload = verifyJwt({ secret: this._secret, token, options })
    const sub = payload.sub
    if (typeof sub !== 'string' || !sub.startsWith('did:')) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    if (scopes.length > 0 && !scopes.includes(payload.scope)) {
      throw new InvalidRequestError('Bad token scope', 'InvalidToken')
    }

    return {
      did: sub,
      scope: payload.scope,
      token,
      payload,
    }
  }

  validateAccessToken(req: express.Request, scopes: AuthScope[]): AccessOutput {
    const { did, scope, token } = this.validateBearerToken(req, scopes)
    return {
      credentials: {
        type: 'access',
        did,
        scope,
      },
      artifacts: token,
    }
  }

  parseRoleCreds(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = RoleStatus
    if (!parsed) {
      return { status: Missing, admin: false, moderator: false, triage: false }
    }
    const { username, password } = parsed
    if (username === 'admin' && password === this._adminPass) {
      return { status: Valid, admin: true, moderator: true, triage: true }
    }
    if (username === 'admin' && password === this._moderatorPass) {
      return { status: Valid, admin: false, moderator: true, triage: true }
    }
    if (username === 'admin' && password === this._triagePass) {
      return { status: Valid, admin: false, moderator: false, triage: true }
    }
    return { status: Invalid, admin: false, moderator: false, triage: false }
  }

  isUserOrAdmin(
    auth: AccessOutput | RoleOutput | NullOutput,
    did: string,
  ): boolean {
    if (!auth.credentials) {
      return false
    }
    if ('did' in auth.credentials) {
      return auth.credentials.did === did
    }
    return auth.credentials.admin
  }
}

// HELPERS
// ---------

const BEARER = 'Bearer '
const BASIC = 'Basic '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const bearerTokenFromReq = (req: express.Request) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith(BEARER)) return null
  return header.slice(BEARER.length)
}

const verifyJwt = (params: {
  secret: string
  token: string
  options?: jwt.VerifyOptions
}): jwt.JwtPayload => {
  const { secret, token, options } = params
  try {
    const payload = jwt.verify(token, secret, options)
    if (typeof payload === 'string' || 'signature' in payload) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    return payload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new InvalidRequestError('Token has expired', 'ExpiredToken')
    }
    throw new InvalidRequestError('Token could not be verified', 'InvalidToken')
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
