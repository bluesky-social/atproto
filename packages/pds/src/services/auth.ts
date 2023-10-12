import * as jwt from 'jsonwebtoken'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import { HOUR } from '@atproto/common'
import Database from '../db'
import { AuthScope } from '../auth-verifier'

const REFRESH_GRACE_MS = 2 * HOUR

export type AuthToken = {
  scope: AuthScope
  sub: string
  exp: number
}

export type RefreshToken = AuthToken & { jti: string }

export class AuthService {
  constructor(public db: Database, private _secret: string) {}

  static creator(jwtSecret: string) {
    return (db: Database) => new AuthService(db, jwtSecret)
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

  async createSession(did: string, appPasswordName: string | null) {
    const access = this.createAccessToken({
      did,
      scope: appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
    })
    const refresh = this.createRefreshToken({ did })
    await this.storeRefreshToken(refresh.payload, appPasswordName)
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

  async rotateRefreshToken(id: string) {
    this.db.assertTransaction()
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

    const refresh = this.createRefreshToken({
      did: token.did,
      jti: nextId,
    })
    const access = this.createAccessToken({
      did: token.did,
      scope:
        token.appPasswordName === null ? AuthScope.Access : AuthScope.AppPass,
    })
    await this.storeRefreshToken(refresh.payload, token.appPasswordName)

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
