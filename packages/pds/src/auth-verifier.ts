import { KeyObject, createPublicKey, createSecretKey } from 'node:crypto'
import {
  AuthRequiredError,
  ForbiddenError,
  InvalidRequestError,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { IdResolver } from '@atproto/identity'
import * as ui8 from 'uint8arrays'
import express from 'express'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import { AccountManager } from './account-manager'
import { softDeleted } from './db'

type ReqCtx = {
  req: express.Request
}

// @TODO sync-up with current method names, consider backwards compat.
export enum AuthScope {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  AppPass = 'com.atproto.appPass',
  Deactivated = 'com.atproto.deactivated',
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

type AdminServiceOutput = {
  credentials: {
    type: 'service'
    aud: string
    iss: string
  }
}

type AccessOutput = {
  credentials: {
    type: 'access'
    did: string
    scope: AuthScope
    audience: string | undefined
  }
  artifacts: string
}

type RefreshOutput = {
  credentials: {
    type: 'refresh'
    did: string
    scope: AuthScope
    audience: string | undefined
    tokenId: string
  }
  artifacts: string
}

type UserDidOutput = {
  credentials: {
    type: 'user_did'
    aud: string
    iss: string
  }
}

type ValidatedBearer = {
  did: string
  scope: AuthScope
  token: string
  payload: jose.JWTPayload
  audience: string | undefined
}

export type AuthVerifierOpts = {
  jwtKey: KeyObject
  adminPass: string
  moderatorPass: string
  triagePass: string
  dids: {
    pds: string
    entryway?: string
    admin: string
  }
}

export class AuthVerifier {
  private _jwtKey: KeyObject
  private _adminPass: string
  private _moderatorPass: string
  private _triagePass: string
  public dids: AuthVerifierOpts['dids']

  constructor(
    public accountManager: AccountManager,
    public idResolver: IdResolver,
    opts: AuthVerifierOpts,
  ) {
    this._jwtKey = opts.jwtKey
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
    this.dids = opts.dids
  }

  // verifiers (arrow fns to preserve scope)

  access = (ctx: ReqCtx): Promise<AccessOutput> => {
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
  }

  accessCheckTakedown = async (ctx: ReqCtx): Promise<AccessOutput> => {
    const result = await this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
    const found = await this.accountManager.getAccount(result.credentials.did, {
      includeDeactivated: true,
    })
    if (!found) {
      // will be turned into ExpiredToken for the client if proxied by entryway
      throw new ForbiddenError('Account not found', 'AccountNotFound')
    }
    if (softDeleted(found)) {
      throw new AuthRequiredError(
        'Account has been taken down',
        'AccountTakedown',
      )
    }
    return result
  }

  accessNotAppPassword = (ctx: ReqCtx): Promise<AccessOutput> => {
    return this.validateAccessToken(ctx.req, [AuthScope.Access])
  }

  accessDeactived = (ctx: ReqCtx): Promise<AccessOutput> => {
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
      AuthScope.Deactivated,
    ])
  }

  refresh = async (ctx: ReqCtx): Promise<RefreshOutput> => {
    const { did, scope, token, audience, payload } =
      await this.validateBearerToken(ctx.req, [AuthScope.Refresh], {
        // when using entryway, proxying refresh credentials
        audience: this.dids.entryway ? this.dids.entryway : this.dids.pds,
      })
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
        audience,
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

  accessOrRole = async (ctx: ReqCtx): Promise<AccessOutput | RoleOutput> => {
    if (isBearerToken(ctx.req)) {
      return this.access(ctx)
    } else {
      return this.role(ctx)
    }
  }

  optionalAccessOrRole = async (
    ctx: ReqCtx,
  ): Promise<AccessOutput | RoleOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return await this.access(ctx)
    } else {
      const creds = this.parseRoleCreds(ctx.req)
      if (creds.status === RoleStatus.Valid) {
        return {
          credentials: {
            ...creds,
            type: 'role',
          },
        }
      } else if (creds.status === RoleStatus.Missing) {
        return { credentials: null }
      } else {
        throw new AuthRequiredError()
      }
    }
  }

  userDidAuth = async (reqCtx: ReqCtx): Promise<UserDidOutput> => {
    const payload = await this.verifyServiceJwt(reqCtx, {
      aud: this.dids.entryway ?? this.dids.pds,
      iss: null,
    })
    return {
      credentials: {
        type: 'user_did',
        aud: payload.aud,
        iss: payload.iss,
      },
    }
  }

  userDidAuthOptional = async (
    reqCtx: ReqCtx,
  ): Promise<UserDidOutput | NullOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return await this.userDidAuth(reqCtx)
    } else {
      return { credentials: null }
    }
  }

  adminService = async (reqCtx: ReqCtx): Promise<AdminServiceOutput> => {
    const payload = await this.verifyServiceJwt(reqCtx, {
      aud: this.dids.entryway ?? this.dids.pds,
      iss: [this.dids.admin],
    })
    return {
      credentials: {
        type: 'service',
        aud: payload.aud,
        iss: payload.iss,
      },
    }
  }

  roleOrAdminService = async (
    reqCtx: ReqCtx,
  ): Promise<RoleOutput | AdminServiceOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.adminService(reqCtx)
    } else {
      return this.role(reqCtx)
    }
  }

  async validateBearerToken(
    req: express.Request,
    scopes: AuthScope[],
    verifyOptions?: jose.JWTVerifyOptions,
  ): Promise<ValidatedBearer> {
    const token = bearerTokenFromReq(req)
    if (!token) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    const payload = await verifyJwt({ key: this._jwtKey, token, verifyOptions })
    const { sub, aud, scope } = payload
    if (typeof sub !== 'string' || !sub.startsWith('did:')) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    if (
      aud !== undefined &&
      (typeof aud !== 'string' || !aud.startsWith('did:'))
    ) {
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }
    if (!isAuthScope(scope) || (scopes.length > 0 && !scopes.includes(scope))) {
      throw new InvalidRequestError('Bad token scope', 'InvalidToken')
    }
    return {
      did: sub,
      scope,
      audience: aud,
      token,
      payload,
    }
  }

  async validateAccessToken(
    req: express.Request,
    scopes: AuthScope[],
  ): Promise<AccessOutput> {
    const { did, scope, token, audience } = await this.validateBearerToken(
      req,
      scopes,
      { audience: this.dids.pds },
    )
    return {
      credentials: {
        type: 'access',
        did,
        scope,
        audience,
      },
      artifacts: token,
    }
  }

  async verifyServiceJwt(
    reqCtx: ReqCtx,
    opts: { aud: string | null; iss: string[] | null },
  ) {
    const getSigningKey = async (
      did: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(did)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      return this.idResolver.did.resolveAtprotoKey(did, forceRefresh)
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyServiceJwt(jwtStr, opts.aud, getSigningKey)
    return { iss: payload.iss, aud: payload.aud }
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

const verifyJwt = async (params: {
  key: KeyObject
  token: string
  verifyOptions?: jose.JWTVerifyOptions
}): Promise<jose.JWTPayload> => {
  const { key, token, verifyOptions } = params
  try {
    const result = await jose.jwtVerify(token, key, verifyOptions)
    return result.payload
  } catch (err) {
    if (err?.['code'] === 'ERR_JWT_EXPIRED') {
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

const authScopes = new Set(Object.values(AuthScope))
const isAuthScope = (val: unknown): val is AuthScope => {
  return authScopes.has(val as any)
}

export const createSecretKeyObject = (secret: string): KeyObject => {
  return createSecretKey(Buffer.from(secret))
}

export const createPublicKeyObject = (publicKeyHex: string): KeyObject => {
  const key = keyEncoder.encodePublic(publicKeyHex, 'raw', 'pem')
  return createPublicKey({ format: 'pem', key })
}

const keyEncoder = new KeyEncoder('secp256k1')
