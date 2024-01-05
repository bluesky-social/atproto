import assert from 'node:assert'
import { KeyObject } from 'node:crypto'
import * as jose from 'jose'
import * as ui8 from 'uint8arrays'
import * as crypto from '@atproto/crypto'
import { AuthScope } from '../../auth-verifier'
import { AccountDb } from '../db'

export type AuthToken = {
  scope: AuthScope
  sub: string
  exp: number
}

export type RefreshToken = AuthToken & { scope: AuthScope.Refresh; jti: string }

export const createTokens = async (opts: {
  did: string
  jwtKey: KeyObject
  serviceDid: string
  scope?: AuthScope
  jti?: string
  expiresIn?: string | number
}) => {
  const { did, jwtKey, serviceDid, scope, jti, expiresIn } = opts
  const [accessJwt, refreshJwt] = await Promise.all([
    createAccessToken({ did, jwtKey, serviceDid, scope, expiresIn }),
    createRefreshToken({ did, jwtKey, serviceDid, jti, expiresIn }),
  ])
  return { accessJwt, refreshJwt }
}

export const createAccessToken = (opts: {
  did: string
  jwtKey: KeyObject
  serviceDid: string
  scope?: AuthScope
  expiresIn?: string | number
}): Promise<string> => {
  const {
    did,
    jwtKey,
    serviceDid,
    scope = AuthScope.Access,
    expiresIn = '120mins',
  } = opts
  const signer = new jose.SignJWT({ scope })
    .setProtectedHeader({ alg: 'HS256' }) // only symmetric keys supported
    .setAudience(serviceDid)
    .setSubject(did)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
  return signer.sign(jwtKey)
}

export const createRefreshToken = (opts: {
  did: string
  jwtKey: KeyObject
  serviceDid: string
  jti?: string
  expiresIn?: string | number
}): Promise<string> => {
  const {
    did,
    jwtKey,
    serviceDid,
    jti = getRefreshTokenId(),
    expiresIn = '90days',
  } = opts
  const signer = new jose.SignJWT({ scope: AuthScope.Refresh })
    .setProtectedHeader({ alg: 'HS256' }) // only symmetric keys supported
    .setAudience(serviceDid)
    .setSubject(did)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
  return signer.sign(jwtKey)
}

// @NOTE unsafe for verification, should only be used w/ direct output from createRefreshToken() or createTokens()
export const decodeRefreshToken = (jwt: string) => {
  const token = jose.decodeJwt(jwt)
  assert.ok(token.scope === AuthScope.Refresh, 'not a refresh token')
  return token as RefreshToken
}

export const storeRefreshToken = async (
  db: AccountDb,
  payload: RefreshToken,
  appPasswordName: string | null,
) => {
  const [result] = await db.executeWithRetry(
    db.db
      .insertInto('refresh_token')
      .values({
        id: payload.jti,
        did: payload.sub,
        appPasswordName,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      })
      .onConflict((oc) => oc.doNothing()), // E.g. when re-granting during a refresh grace period
  )
  return result
}

export const getRefreshToken = async (db: AccountDb, id: string) => {
  return db.db
    .selectFrom('refresh_token')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const deleteExpiredRefreshTokens = async (
  db: AccountDb,
  did: string,
  now: string,
) => {
  await db.executeWithRetry(
    db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .where('expiresAt', '<=', now),
  )
}

export const addRefreshGracePeriod = async (
  db: AccountDb,
  opts: {
    id: string
    expiresAt: string
    nextId: string
  },
) => {
  const { id, expiresAt, nextId } = opts
  const [res] = await db.executeWithRetry(
    db.db
      .updateTable('refresh_token')
      .where('id', '=', id)
      .where((inner) =>
        inner.where('nextId', 'is', null).orWhere('nextId', '=', nextId),
      )
      .set({ expiresAt, nextId })
      .returningAll(),
  )
  if (!res) {
    throw new ConcurrentRefreshError()
  }
}

export const revokeRefreshToken = async (db: AccountDb, id: string) => {
  const [{ numDeletedRows }] = await db.executeWithRetry(
    db.db.deleteFrom('refresh_token').where('id', '=', id),
  )
  return numDeletedRows > 0
}

export const revokeRefreshTokensByDid = async (db: AccountDb, did: string) => {
  const [{ numDeletedRows }] = await db.executeWithRetry(
    db.db.deleteFrom('refresh_token').where('did', '=', did),
  )
  return numDeletedRows > 0
}

export const revokeAppPasswordRefreshToken = async (
  db: AccountDb,
  did: string,
  appPassName: string,
) => {
  const [{ numDeletedRows }] = await db.executeWithRetry(
    db.db
      .deleteFrom('refresh_token')
      .where('did', '=', did)
      .where('appPasswordName', '=', appPassName),
  )

  return numDeletedRows > 0
}

export const getRefreshTokenId = () => {
  return ui8.toString(crypto.randomBytes(32), 'base64')
}

export class ConcurrentRefreshError extends Error {}
