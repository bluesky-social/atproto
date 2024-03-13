import { KeyObject, createPublicKey, createSecretKey } from 'node:crypto'

import { getVerificationMaterial } from '@atproto/common'
import { OAuthError, OAuthVerifier } from '@atproto/oauth-provider'
import {
  AuthRequiredError,
  ForbiddenError,
  InvalidRequestError,
  XRPCError,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import * as ui8 from 'uint8arrays'
import express from 'express'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'

import { AccountManager } from './account-manager'
import { softDeleted } from './db'

type ReqCtx = {
  req: express.Request
  // StreamAuthVerifier does not have "res"
  res?: express.Response
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

type ValidatedRefreshBearer = ValidatedBearer & {
  tokenId: string
}

export type AuthVerifierOpts = {
  publicUrl: string
  jwtKey: KeyObject
  adminPass: string
  dids: {
    pds: string
    entryway?: string
    modService?: string
  }
}

export class AuthVerifier {
  private _publicUrl: string
  private _jwtKey: KeyObject
  private _adminPass: string
  public dids: AuthVerifierOpts['dids']

  constructor(
    public accountManager: AccountManager,
    public idResolver: IdResolver,
    public oauthVerifier: OAuthVerifier,
    opts: AuthVerifierOpts,
  ) {
    this._publicUrl = opts.publicUrl
    this._jwtKey = opts.jwtKey
    this._adminPass = opts.adminPass
    this.dids = opts.dids
  }

  // verifiers (arrow fns to preserve scope)

  access = async (ctx: ReqCtx): Promise<AccessOutput> => {
    await this.setAuthHeaders(ctx)
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
    ])
  }

  accessCheckTakedown = async (ctx: ReqCtx): Promise<AccessOutput> => {
    await this.setAuthHeaders(ctx)
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

  accessNotAppPassword = async (ctx: ReqCtx): Promise<AccessOutput> => {
    await this.setAuthHeaders(ctx)
    return this.validateAccessToken(ctx.req, [AuthScope.Access])
  }

  accessDeactived = async (ctx: ReqCtx): Promise<AccessOutput> => {
    await this.setAuthHeaders(ctx)
    return this.validateAccessToken(ctx.req, [
      AuthScope.Access,
      AuthScope.AppPass,
      AuthScope.Deactivated,
    ])
  }

  refresh = async (ctx: ReqCtx): Promise<RefreshOutput> => {
    await this.setAuthHeaders(ctx)
    const { did, scope, token, tokenId, audience } =
      await this.validateRefreshToken(ctx.req)

    return {
      credentials: {
        type: 'refresh',
        did,
        scope,
        audience,
        tokenId,
      },
      artifacts: token,
    }
  }

  refreshExpired = async (ctx: ReqCtx): Promise<RefreshOutput> => {
    await this.setAuthHeaders(ctx)
    const { did, scope, token, tokenId, audience } =
      await this.validateRefreshToken(ctx.req, { clockTolerance: Infinity })

    return {
      credentials: {
        type: 'refresh',
        did,
        scope,
        audience,
        tokenId,
      },
      artifacts: token,
    }
  }

  adminToken = async (ctx: ReqCtx): Promise<AdminTokenOutput> => {
    await this.setAuthHeaders(ctx)
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
    await this.setAuthHeaders(ctx)
    if (isAccessToken(ctx.req)) {
      return await this.access(ctx)
    } else if (isBasicToken(ctx.req)) {
      return await this.adminToken(ctx)
    } else {
      return this.null()
    }
  }

  userDidAuth = async (reqCtx: ReqCtx): Promise<UserDidOutput> => {
    await this.setAuthHeaders(reqCtx)
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
    await this.setAuthHeaders(reqCtx)
    if (isBearerToken(reqCtx.req)) {
      return await this.userDidAuth(reqCtx)
    } else {
      return this.null()
    }
  }

  modService = async (reqCtx: ReqCtx): Promise<ModServiceOutput> => {
    await this.setAuthHeaders(reqCtx)
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
    await this.setAuthHeaders(reqCtx)
    if (isBearerToken(reqCtx.req)) {
      return this.modService(reqCtx)
    } else {
      return this.adminToken(reqCtx)
    }
  }

  protected async validateRefreshToken(
    req: express.Request,
    verifyOptions?: Omit<jose.JWTVerifyOptions, 'audience'>,
  ): Promise<ValidatedRefreshBearer> {
    const result = await this.validateBearerToken(req, [AuthScope.Refresh], {
      ...verifyOptions,
      // when using entryway, proxying refresh credentials
      audience: this.dids.entryway ? this.dids.entryway : this.dids.pds,
    })
    const tokenId = result.payload.jti
    if (!tokenId) {
      throw new AuthRequiredError(
        'Unexpected missing refresh token id',
        'MissingTokenId',
      )
    }
    return { ...result, tokenId }
  }

  protected async validateBearerToken(
    req: express.Request,
    scopes: AuthScope[],
    verifyOptions?: jose.JWTVerifyOptions,
  ): Promise<ValidatedBearer> {
    const token = bearerTokenFromReq(req)
    if (!token) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }

    const { payload, protectedHeader } = await this.jwtVerify(
      token,
      verifyOptions,
    )

    if (protectedHeader.typ) {
      // Only OAuth Provider sets this claim
      throw new InvalidRequestError('Malformed token', 'InvalidToken')
    }

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
    if ((payload.cnf as any)?.jkt) {
      // DPoP bound tokens must not be usable as regular Bearer tokens
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
    const [type] = parseAuthorizationHeader(req.headers.authorization)
    switch (type) {
      case BEARER:
        return this.validateBearerAccessToken(req, scopes)
      case DPOP:
        return this.validateDpopAccessToken(req, scopes)
      case null:
        throw new AuthRequiredError(undefined, 'AuthMissing')
      default:
        throw new InvalidRequestError(
          'Unexpected authorization type',
          'InvalidToken',
        )
    }
  }

  async validateDpopAccessToken(
    req: express.Request,
    scopes: AuthScope[],
  ): Promise<AccessOutput> {
    if (!scopes.includes(AuthScope.Access)) {
      throw new InvalidRequestError(
        'DPoP access token cannot be used for this request',
        'InvalidToken',
      )
    }

    try {
      const url = new URL(req.originalUrl || req.url, this._publicUrl)
      const result = await this.oauthVerifier.authenticateHttpRequest(
        req.method,
        url,
        req.headers,
        { audience: [this.dids.pds] },
      )

      const { sub } = result.claims
      if (typeof sub !== 'string' || !sub.startsWith('did:')) {
        throw new InvalidRequestError('Malformed token', 'InvalidToken')
      }

      return {
        credentials: {
          type: 'access',
          did: result.claims.sub,
          scope: AuthScope.Access,
          audience: this.dids.pds,
        },
        artifacts: result.token,
      }
    } catch (err) {
      // 'use_dpop_nonce' is expected to be in a particular format. Let's
      // also transform any other OAuthError into an XRPCError.
      if (err instanceof OAuthError) {
        throw new XRPCError(err.status, err.error_description, err.error)
      }

      throw err
    }
  }

  async validateBearerAccessToken(
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

  protected async jwtVerify(
    token: string,
    verifyOptions?: jose.JWTVerifyOptions,
  ) {
    try {
      return await jose.jwtVerify(token, this._jwtKey, verifyOptions)
    } catch (err) {
      if (err?.['code'] === 'ERR_JWT_EXPIRED') {
        throw new InvalidRequestError('Token has expired', 'ExpiredToken')
      }
      throw new InvalidRequestError(
        'Token could not be verified',
        'InvalidToken',
      )
    }
  }

  protected async setAuthHeaders(ctx: ReqCtx) {
    // Prevent caching (on proxies) of auth dependent responses
    ctx.res?.setHeader('Cache-Control', 'private')

    // Make sure that browsers do not return cached responses when the auth header changes
    ctx.res?.appendHeader('Vary', 'Authorization')

    /**
     * Return next DPoP nonce in response headers for DPoP bound tokens.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-8.2}
     */
    const authHeader = ctx.req.headers.authorization
    if (authHeader?.startsWith('DPoP')) {
      const dpopNonce = this.oauthVerifier.nextDpopNonce()
      if (dpopNonce) {
        const name = 'DPoP-Nonce'
        ctx.res?.setHeader(name, dpopNonce)
        ctx.res?.appendHeader('Access-Control-Expose-Headers', name)
      }
    }
  }
}

// HELPERS
// ---------

const BASIC = 'Basic'
const BEARER = 'Bearer'
const DPOP = 'DPoP'

export const parseAuthorizationHeader = (authorization?: string) => {
  const result = authorization?.split(' ', 2)
  if (result?.length === 2) return result as [type: string, token: string]
  return [null] as [type: null]
}

const isAccessToken = (req: express.Request): boolean => {
  const [type] = parseAuthorizationHeader(req.headers.authorization)
  return type === BEARER || type === DPOP
}

const isBearerToken = (req: express.Request): boolean => {
  const [type] = parseAuthorizationHeader(req.headers.authorization)
  return type === BEARER
}

const isBasicToken = (req: express.Request): boolean => {
  return req.headers.authorization?.startsWith(BASIC) ?? false
}

const bearerTokenFromReq = (req: express.Request) => {
  const [type, token] = parseAuthorizationHeader(req.headers.authorization)
  return type === BEARER ? token : null
}

export const parseBasicAuth = (
  token: string,
): { username: string; password: string } | null => {
  try {
    const [type, b64] = parseAuthorizationHeader(token)
    if (type !== BASIC) return null
    const parsed = ui8
      .toString(ui8.fromString(b64, 'base64pad'), 'utf8')
      .split(':', 2)
    const [username, password] = parsed
    if (!username || !password) return null
    return { username, password }
  } catch (err) {
    return null
  }
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
