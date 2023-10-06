import * as assert from 'node:assert'
import { KeyObject, createPrivateKey, createSecretKey } from 'node:crypto'
import express from 'express'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import * as jose from 'jose'
import * as crypto from '@atproto/crypto'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import AppContext from './context'
import { softDeleted } from './db/util'

const BEARER = 'Bearer '
const BASIC = 'Basic '
const SECP256K1_JWT = 'ES256K'
const HMACSHA256_JWT = 'HS256'

export type ServerAuthOpts = {
  jwtSecret: string
  jwtSigningKey?: crypto.Secp256k1Keypair
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
  aud?: string
}

export type RefreshToken = AuthToken & { jti: string; aud: string }

export class ServerAuth {
  private _signingSecret: KeyObject
  private _signingKeyPromise?: Promise<KeyObject>
  private _adminPass: string
  private _moderatorPass?: string
  private _triagePass?: string

  constructor(opts: ServerAuthOpts) {
    this._signingSecret = createSecretKey(Buffer.from(opts.jwtSecret))
    this._signingKeyPromise =
      opts.jwtSigningKey && createPrivateKeyObject(opts.jwtSigningKey)
    this._adminPass = opts.adminPass
    this._moderatorPass = opts.moderatorPass
    this._triagePass = opts.triagePass
  }

  async createAccessToken(opts: {
    did: string
    pdsDid?: string | null
    scope?: AuthScope
    expiresIn?: string | number
  }) {
    const { did, scope = AuthScope.Access, expiresIn = '120mins' } = opts

    const signer = new jose.SignJWT({ scope })
      .setSubject(did)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
    if (opts.pdsDid) {
      signer.setAudience(opts.pdsDid)
    }

    if (this._signingKeyPromise) {
      const key = await this._signingKeyPromise
      return signer.setProtectedHeader({ alg: SECP256K1_JWT }).sign(key)
    } else {
      const key = this._signingSecret
      return signer.setProtectedHeader({ alg: HMACSHA256_JWT }).sign(key)
    }
  }

  async createRefreshToken(opts: {
    did: string
    identityDid: string
    jti?: string
    expiresIn?: string | number
  }) {
    const { did, jti = getRefreshTokenId(), expiresIn = '90days' } = opts

    const signer = new jose.SignJWT({ scope: AuthScope.Refresh })
      .setSubject(did)
      .setAudience(opts.identityDid)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(expiresIn)

    if (this._signingKeyPromise) {
      const key = await this._signingKeyPromise
      return signer.setProtectedHeader({ alg: SECP256K1_JWT }).sign(key)
    } else {
      const key = this._signingSecret
      return signer.setProtectedHeader({ alg: HMACSHA256_JWT }).sign(key)
    }
  }

  // @NOTE unsafe for verification, should only be used w/ direct output from createRefreshToken()
  decodeRefreshToken(jwt: string) {
    const token = jose.decodeJwt(jwt)
    assert.ok(token.scope === AuthScope.Refresh, 'not a refresh token')
    return token as RefreshToken
  }

  async getCredentials(
    req: express.Request,
    scopes = [AuthScope.Access],
  ): Promise<{ did: string; scope: AuthScope; audience?: string } | null> {
    const token = this.getToken(req)
    if (!token) return null
    const payload = await this.verifyToken(token, scopes)
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
    return {
      did: sub,
      audience: aud,
      scope: scope as AuthScope,
    }
  }

  async getCredentialsOrThrow(
    req: express.Request,
    scopes: AuthScope[],
  ): Promise<{ did: string; scope: AuthScope; audience?: string }> {
    const creds = await this.getCredentials(req, scopes)
    if (creds === null) {
      throw new AuthRequiredError(undefined, 'AuthMissing')
    }
    return creds
  }

  verifyRole(req: express.Request) {
    const parsed = parseBasicAuth(req.headers.authorization || '')
    const { Missing, Valid, Invalid } = AuthStatus
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

  getToken(req: express.Request) {
    const header = req.headers.authorization || ''
    if (!header.startsWith(BEARER)) return null
    return header.slice(BEARER.length)
  }

  async verifyToken(
    token: string,
    scopes: AuthScope[],
    options?: jose.JWTVerifyOptions,
  ): Promise<jose.JWTPayload> {
    const header = jose.decodeProtectedHeader(token)
    let result: jose.JWTVerifyResult
    try {
      if (header.alg === SECP256K1_JWT && this._signingKeyPromise) {
        const key = await this._signingKeyPromise
        result = await jose.jwtVerify(token, key, options)
      } else {
        const key = this._signingSecret
        result = await jose.jwtVerify(token, key, options)
      }
    } catch (err) {
      if (err?.['code'] === 'ERR_JWT_EXPIRED') {
        throw new InvalidRequestError('Token has expired', 'ExpiredToken')
      }
      throw new InvalidRequestError(
        'Token could not be verified',
        'InvalidToken',
      )
    }
    if (scopes.length > 0 && !scopes.includes(result.payload.scope as any)) {
      throw new InvalidRequestError('Bad token scope', 'InvalidToken')
    }
    return result.payload
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
    const creds = await auth.getCredentialsOrThrow(ctx.req, [
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
    const creds = await auth.getCredentialsOrThrow(ctx.req, [AuthScope.Access])
    return {
      credentials: creds,
      artifacts: auth.getToken(ctx.req),
    }
  }

export const accessVerifierCheckTakedown =
  (auth: ServerAuth, { db, services }: AppContext) =>
  async (ctx: { req: express.Request; res: express.Response }) => {
    const creds = await auth.getCredentialsOrThrow(ctx.req, [
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
    const creds = await auth.getCredentialsOrThrow(ctx.req, [AuthScope.Refresh])
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

const createPrivateKeyObject = async (
  privateKey: crypto.Secp256k1Keypair,
): Promise<KeyObject> => {
  const raw = await privateKey.export()
  const key = keyEncoder.encodePrivate(ui8.toString(raw, 'hex'), 'raw', 'pem')
  return createPrivateKey({ format: 'pem', key })
}

const keyEncoder = new KeyEncoder('secp256k1')
