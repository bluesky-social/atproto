import {
  KeyObject,
  createPrivateKey,
  createPublicKey,
  createSecretKey,
} from 'node:crypto'
import * as crypto from '@atproto/crypto'
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
import Database from './db'
import { softDeleted } from './db/util'
import { SigningKeyMemory, VerifyKey } from './config'

type ReqCtx = {
  req: express.Request
}

// @TODO sync-up with current method names, consider backwards compat.
export enum AuthScope {
  Access = 'com.atproto.access',
  Refresh = 'com.atproto.refresh',
  AppPass = 'com.atproto.appPass',
  Deactivated = 'com.atproto.deactivated',
  CreateAccount = 'com.atproto.createAccount',
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

type AccessCheckedOutput = AccessOutput & {
  credentials: {
    pdsDid: string | null
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

type ValidatedBearer = {
  did: string
  scope: AuthScope
  token: string
  payload: jose.JWTPayload
  audience: string | undefined
}

export type AuthVerifierOpts = {
  authKeys: AuthKeys
  adminPass: string
  moderatorPass: string
  triagePass: string
  pdsServiceDid: string
  modServiceDid: string
}

export class AuthVerifier {
  private _signingSecret: KeyObject
  private _verifyKey?: KeyObject
  private _adminPass: string
  private _moderatorPass: string
  private _triagePass: string
  private _pdsServiceDid: string
  private _modServiceDid: string

  constructor(
    public db: Database,
    public idResolver: IdResolver,
    opts: AuthVerifierOpts,
  ) {
    this._signingSecret = opts.authKeys.signingSecret
    this._verifyKey = opts.authKeys.verifyKey
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
    this._pdsServiceDid = opts.pdsServiceDid
    this._modServiceDid = opts.modServiceDid
  }

  // verifiers (arrow fns to preserve scope)

  access = (ctx: ReqCtx): Promise<AccessOutput> => {
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
  }

  accessCheckTakedown = async (ctx: ReqCtx): Promise<AccessCheckedOutput> => {
    const result = await this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
    const found = await this.db.db
      .selectFrom('user_account')
      .leftJoin('pds', 'pds.id', 'user_account.pdsId')
      .where('user_account.did', '=', result.credentials.did)
      .select(['user_account.did', 'pds.did as pdsDid', 'takedownRef'])
      .executeTakeFirst()
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
    return {
      ...result,
      credentials: { ...result.credentials, pdsDid: found.pdsDid },
    }
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

  // @TODO additional check on aud when set
  refresh = async (ctx: ReqCtx): Promise<RefreshOutput> => {
    const { did, scope, token, audience, payload } =
      await this.validateBearerToken(ctx.req, [AuthScope.Refresh])
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

  adminService = async (reqCtx: ReqCtx): Promise<AdminServiceOutput> => {
    const jwtStr = bearerTokenFromReq(reqCtx.req)
    if (!jwtStr) {
      throw new AuthRequiredError('missing jwt', 'MissingJwt')
    }
    const payload = await verifyServiceJwt(
      jwtStr,
      this._pdsServiceDid,
      async (did, forceRefresh) => {
        if (did !== this._modServiceDid) {
          throw new AuthRequiredError(
            'Untrusted issuer for admin actions',
            'UntrustedIss',
          )
        }
        return this.idResolver.did.resolveAtprotoKey(did, forceRefresh)
      },
    )
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
    const payload = await this.verifyJwt({ token, verifyOptions })
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

  verifyJwt(params: { token: string; verifyOptions?: jose.JWTVerifyOptions }) {
    return verifyJwt({
      ...params,
      keys: {
        verifyKey: this._verifyKey,
        signingSecret: this._signingSecret,
      },
    })
  }

  async validateAccessToken(
    req: express.Request,
    scopes: AuthScope[],
  ): Promise<AccessOutput> {
    const { did, scope, token, audience } = await this.validateBearerToken(
      req,
      scopes,
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

  createAdminRoleHeaders = () => {
    return {
      authorization:
        'Basic ' +
        ui8.toString(
          ui8.fromString(`admin:${this._adminPass}`, 'utf8'),
          'base64pad',
        ),
    }
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
export const SECP256K1_JWT = 'ES256K'
export const HMACSHA256_JWT = 'HS256'

export const getAuthKeys = async (opts: AuthKeyOptions): Promise<AuthKeys> => {
  const signingSecret = createSecretKey(Buffer.from(opts.jwtSecret))
  const signingKeypair =
    opts.jwtSigningKey &&
    (await crypto.Secp256k1Keypair.import(opts.jwtSigningKey.privateKeyHex, {
      exportable: true,
    }))
  const signingKey = signingKeypair
    ? await createPrivateKeyObject(signingKeypair)
    : undefined
  const verifyKey = opts.jwtVerifyKey
    ? await createPublicKeyObject(opts.jwtVerifyKey.publicKeyHex)
    : signingKey
  return { signingSecret, signingKey, verifyKey }
}

type AuthKeyOptions = {
  jwtSecret: string
  jwtSigningKey?: SigningKeyMemory
  jwtVerifyKey?: VerifyKey
}

export type AuthKeys = {
  signingSecret: KeyObject
  signingKey?: KeyObject
  verifyKey?: KeyObject
}

const isBearerToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BEARER) ?? false
}

const bearerTokenFromReq = (req: express.Request) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith(BEARER)) return null
  return header.slice(BEARER.length)
}

const verifyJwt = async (params: {
  token: string
  keys: { verifyKey?: KeyObject; signingSecret: KeyObject }
  verifyOptions?: jose.JWTVerifyOptions
}): Promise<jose.JWTPayload> => {
  const { token, keys, verifyOptions } = params
  let result: jose.JWTVerifyResult
  try {
    const header = jose.decodeProtectedHeader(token)
    if (header.alg === SECP256K1_JWT && keys.verifyKey) {
      const key = keys.verifyKey
      result = await jose.jwtVerify(token, key, verifyOptions)
    } else {
      const key = keys.signingSecret
      result = await jose.jwtVerify(token, key, verifyOptions)
    }
  } catch (err) {
    if (err?.['code'] === 'ERR_JWT_EXPIRED') {
      throw new InvalidRequestError('Token has expired', 'ExpiredToken')
    }
    throw new InvalidRequestError('Token could not be verified', 'InvalidToken')
  }
  return result.payload
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

const createPrivateKeyObject = async (
  privateKey: crypto.Secp256k1Keypair,
): Promise<KeyObject> => {
  const raw = await privateKey.export()
  const key = keyEncoder.encodePrivate(ui8.toString(raw, 'hex'), 'raw', 'pem')
  return createPrivateKey({ format: 'pem', key })
}

const createPublicKeyObject = async (
  publicKeyHex: string,
): Promise<KeyObject> => {
  const key = keyEncoder.encodePublic(publicKeyHex, 'raw', 'pem')
  return createPublicKey({ format: 'pem', key })
}

const keyEncoder = new KeyEncoder('secp256k1')
