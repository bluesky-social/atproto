import assert from 'node:assert'
import * as jose from 'jose'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import { HOUR } from '@atproto/common'
import Database from '../db'
import {
  AuthKeys,
  AuthScope,
  SECP256K1_JWT,
  HMACSHA256_JWT,
} from '../auth-verifier'

const REFRESH_GRACE_MS = 2 * HOUR

export type AuthToken = {
  scope: AuthScope
  sub: string
  exp: number
}

export type RefreshToken = AuthToken & { jti: string }

export class AuthService {
  constructor(
    public db: Database,
    private identityDid: string,
    private authKeys: AuthKeys,
  ) {}

  static creator(pdsDid: string, authKeys: AuthKeys) {
    return (db: Database) => new AuthService(db, pdsDid, authKeys)
  }

  createAccessToken(opts: {
    did: string
    pdsDid: string | null
    scope?: AuthScope
    expiresIn?: string | number
  }) {
    const { scope = AuthScope.Access, expiresIn = '120mins' } = opts

    const signer = new jose.SignJWT({ scope })
      .setSubject(opts.did)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
    if (opts.pdsDid) {
      signer.setAudience(opts.pdsDid)
    }

    if (this.authKeys.signingKey) {
      const key = this.authKeys.signingKey
      return signer.setProtectedHeader({ alg: SECP256K1_JWT }).sign(key)
    } else {
      const key = this.authKeys.signingSecret
      return signer.setProtectedHeader({ alg: HMACSHA256_JWT }).sign(key)
    }
  }

  createRefreshToken(opts: {
    did: string
    jti?: string
    expiresIn?: string | number
  }) {
    const { jti = getRefreshTokenId(), expiresIn = '90days' } = opts

    const signer = new jose.SignJWT({ scope: AuthScope.Refresh })
      .setSubject(opts.did)
      .setAudience(this.identityDid)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(expiresIn)

    if (this.authKeys.signingKey) {
      const key = this.authKeys.signingKey
      return signer.setProtectedHeader({ alg: SECP256K1_JWT }).sign(key)
    } else {
      const key = this.authKeys.signingSecret
      return signer.setProtectedHeader({ alg: HMACSHA256_JWT }).sign(key)
    }
  }

  async createSession(opts: {
    did: string
    pdsDid: string | null
    appPasswordName: string | null
    deactivated: boolean
  }) {
    const { did, pdsDid, appPasswordName, deactivated } = opts
    const [access, refresh] = await Promise.all([
      this.createAccessToken({
        did,
        pdsDid,
        scope: determineScope(appPasswordName, deactivated),
      }),
      this.createRefreshToken({ did }),
    ])
    const refreshPayload = decodeRefreshToken(refresh)
    await this.storeRefreshToken(refreshPayload, appPasswordName)
    return { access, refresh }
  }

  async storeRefreshToken(
    payload: RefreshToken,
    appPasswordName: string | null,
  ) {
    return this.db.db
      .insertInto('refresh_token')
      .values({
        id: payload.jti,
        did: payload.sub,
        appPasswordName,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      })
      .onConflict((oc) => oc.doNothing()) // E.g. when re-granting during a refresh grace period
      .executeTakeFirst()
  }

  async rotateRefreshToken(opts: {
    id: string
    pdsDid: string | null
    deactived: boolean
  }) {
    this.db.assertTransaction()
    const { id, pdsDid } = opts
    const token = await this.db.db
      .selectFrom('refresh_token')
      .if(this.db.dialect !== 'sqlite', (qb) => qb.forUpdate())
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
    if (!token) return null

    // take the chance to tidy all of a user's expired tokens
    const now = new Date()
    await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', token.did)
      .where('expiresAt', '<=', now.toISOString())
      .returningAll()
      .executeTakeFirst()

    // Shorten the refresh token lifespan down from its
    // original expiration time to its revocation grace period.
    const prevExpiresAt = new Date(token.expiresAt)
    const graceExpiresAt = new Date(now.getTime() + REFRESH_GRACE_MS)

    const expiresAt =
      graceExpiresAt < prevExpiresAt ? graceExpiresAt : prevExpiresAt

    if (expiresAt <= now) {
      return null
    }

    // Determine the next refresh token id: upon refresh token
    // reuse you always receive a refresh token with the same id.
    const nextId = token.nextId ?? getRefreshTokenId()

    // Update token w/ possibly-updated expiration time
    // and next id, and tidy all of user's expired tokens.
    await this.db.db
      .updateTable('refresh_token')
      .where('id', '=', id)
      .set({ expiresAt: expiresAt.toISOString(), nextId })
      .executeTakeFirst()

    const [refresh, access] = await Promise.all([
      this.createRefreshToken({
        did: token.did,
        jti: nextId,
      }),
      this.createAccessToken({
        did: token.did,
        pdsDid,
        scope: determineScope(token.appPasswordName, opts.deactived),
      }),
    ])

    const refreshPayload = decodeRefreshToken(refresh)
    await this.storeRefreshToken(refreshPayload, token.appPasswordName)

    return { access, refresh }
  }

  async revokeRefreshToken(id: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('id', '=', id)
      .executeTakeFirst()
    return numDeletedRows > 0
  }

  async revokeRefreshTokensByDid(did: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .executeTakeFirst()
    return numDeletedRows > 0
  }

  async revokeAppPasswordRefreshToken(did: string, appPassName: string) {
    const { numDeletedRows } = await this.db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .where('appPasswordName', '=', appPassName)
      .executeTakeFirst()
    return numDeletedRows > 0
  }
}

const getRefreshTokenId = () => {
  return ui8.toString(crypto.randomBytes(32), 'base64')
}

// @NOTE unsafe for verification, should only be used w/ direct output from createRefreshToken()
const decodeRefreshToken = (jwt: string) => {
  const token = jose.decodeJwt(jwt)
  assert.ok(token.scope === AuthScope.Refresh, 'not a refresh token')
  return token as RefreshToken
}

const determineScope = (
  appPasswordName: string | null,
  deactivated: boolean,
): AuthScope => {
  if (deactivated) return AuthScope.Deactivated
  if (appPasswordName !== null) return AuthScope.AppPass
  return AuthScope.Access
}
