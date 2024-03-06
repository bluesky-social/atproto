import { KeyObject, createPublicKey, createSecretKey } from 'node:crypto'
import {
  AuthRequiredError,
  ForbiddenError,
  InvalidRequestError,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import * as ui8 from 'uint8arrays'
import express from 'express'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import { AccountManager } from './account-manager'
import { softDeleted } from './db'
import { getVerificationMaterial } from '@atproto/common'

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

type AdminTokenOutput = {
  credentials: {
    type: 'admin_token'
  }
}

type ModServiceOutput = {
  credentials: {
    type: 'mod_service'
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
  dids: {
    pds: string
    entryway?: string
    modService?: string
  }
}

export class AuthVerifier {
  private _jwtKey: KeyObject
  private _adminPass: string
  public dids: AuthVerifierOpts['dids']

  constructor(
    public accountManager: AccountManager,
    public idResolver: IdResolver,
    opts: AuthVerifierOpts,
  ) {
    this._jwtKey = opts.jwtKey
    this._adminPass = opts.adminPass
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

  adminToken = (ctx: ReqCtx): AdminTokenOutput => {
    const parsed = parseBasicAuth(ctx.req.headers.authorization || '')
    if (!parsed) {
      throw new AuthRequiredError()
    }
    const { username, password } = parsed
    if (username !== 'admin' || password !== this._adminPass) {
      throw new AuthRequiredError()
    }
    return { credentials: { type: 'admin_token' } }
  }

  optionalAccessOrAdminToken = async (
    ctx: ReqCtx,
  ): Promise<AccessOutput | AdminTokenOutput | NullOutput> => {
    if (isBearerToken(ctx.req)) {
      return await this.access(ctx)
    } else if (isBasicToken(ctx.req)) {
      return await this.adminToken(ctx)
    } else {
      return this.null()
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
      return this.null()
    }
  }

  modService = async (reqCtx: ReqCtx): Promise<ModServiceOutput> => {
    if (!this.dids.modService) {
      throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
    }
    const payload = await this.verifyServiceJwt(reqCtx, {
      aud: null,
      iss: [this.dids.modService, `${this.dids.modService}#atproto_labeler`],
    })
    if (
      payload.aud !== this.dids.pds &&
      (!this.dids.entryway || payload.aud !== this.dids.entryway)
    ) {
      throw new AuthRequiredError(
        'jwt audience does not match service did',
        'BadJwtAudience',
      )
    }
    return {
      credentials: {
        type: 'mod_service',
        aud: payload.aud,
        iss: payload.iss,
      },
    }
  }

  moderator = async (
    reqCtx: ReqCtx,
  ): Promise<AdminTokenOutput | ModServiceOutput> => {
    if (isBearerToken(reqCtx.req)) {
      return this.modService(reqCtx)
    } else {
      return this.adminToken(reqCtx)
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
      iss: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      if (opts.iss !== null && !opts.iss.includes(iss)) {
        throw new AuthRequiredError('Untrusted issuer', 'UntrustedIss')
      }
      const [did, serviceId] = iss.split('#')
      const keyId =
        serviceId === 'atproto_labeler' ? 'atproto_label' : 'atproto'
      const didDoc = await this.idResolver.did.resolve(did, forceRefresh)
      if (!didDoc) {
        throw new AuthRequiredError('could not resolve iss did')
      }
      const parsedKey = getVerificationMaterial(didDoc, keyId)
      if (!parsedKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      const didKey = getDidKeyFromMultibase(parsedKey)
      if (!didKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      return didKey
    }

    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyServiceJwt(jwtStr, opts.aud, getSigningKey)
    return { iss: payload.iss, aud: payload.aud }
  }

  null(): NullOutput {
    return {
      credentials: null,
    }
  }

  isUserOrAdmin(
    auth: AccessOutput | AdminTokenOutput | NullOutput,
    did: string,
  ): boolean {
    if (!auth.credentials) {
      return false
    } else if (auth.credentials.type === 'admin_token') {
      return true
    } else {
      return auth.credentials.did === did
    }
  }
}

// HELPERS
// ---------

const BEARER = 'Bearer '
const BASIC = 'Basic '

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const isBasicToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BASIC) ?? false
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
