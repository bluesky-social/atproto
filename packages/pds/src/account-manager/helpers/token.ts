import { Selectable } from 'kysely'
import {
  Code,
  NewTokenData,
  RefreshToken,
  TokenData,
  TokenId,
} from '@atproto/oauth-provider'
import { fromDateISO, fromJson, toDateISO, toJson } from '../../db'
import { AccountDb, Token } from '../db'
import { selectAccountQB } from './account'

export function toTokenData(row: Selectable<Token>): TokenData {
  return {
    createdAt: fromDateISO(row.createdAt),
    expiresAt: fromDateISO(row.expiresAt),
    updatedAt: fromDateISO(row.updatedAt),
    clientId: row.clientId,
    clientAuth: fromJson(row.clientAuth),
    deviceId: row.deviceId,
    sub: row.did,
    parameters: fromJson(row.parameters),
    code: row.code,
    scope: row.scope,
  }
}

const selectTokenInfoQB = (db: AccountDb) =>
  selectAccountQB(db, { includeDeactivated: true })
    // uses "token_did_idx" index (though unlikely in practice)
    .innerJoin('token', 'token.did', 'actor.did')
    .select([
      'token.id',
      'token.tokenId',
      'token.createdAt',
      'token.updatedAt',
      'token.expiresAt',
      'token.clientId',
      'token.clientAuth',
      'token.deviceId',
      'token.did',
      'token.parameters',
      'token.details',
      'token.code',
      'token.currentRefreshToken',
      'token.scope',
    ])

export const createQB = (
  db: AccountDb,
  tokenId: TokenId,
  data: TokenData,
  refreshToken?: RefreshToken,
) => {
  return db.db.insertInto('token').values({
    tokenId,
    createdAt: toDateISO(data.createdAt),
    expiresAt: toDateISO(data.expiresAt),
    updatedAt: toDateISO(data.updatedAt),
    clientId: data.clientId,
    clientAuth: toJson(data.clientAuth),
    deviceId: data.deviceId,
    did: data.sub,
    parameters: toJson(data.parameters),
    details: data.details ? toJson(data.details) : null,
    code: data.code,
    currentRefreshToken: refreshToken || null,
    scope: data.scope,
  })
}

export const forRotateQB = (db: AccountDb, id: TokenId) =>
  db.db
    .selectFrom('token')
    .where('tokenId', '=', id)
    .where('currentRefreshToken', 'is not', null)
    .select(['id', 'currentRefreshToken'])

export const findByQB = (
  db: AccountDb,
  search: {
    id?: number
    did?: string
    code?: Code
    tokenId?: TokenId
    currentRefreshToken?: RefreshToken
  },
) => {
  if (
    search.id === undefined &&
    search.did === undefined &&
    search.code === undefined &&
    search.tokenId === undefined &&
    search.currentRefreshToken === undefined
  ) {
    // Prevent accidental scan
    throw new TypeError('At least one search parameter is required')
  }

  return selectTokenInfoQB(db)
    .if(search.id !== undefined, (qb) =>
      // uses primary key index
      qb.where('token.id', '=', search.id!),
    )
    .if(search.did !== undefined, (qb) =>
      // uses "token_did_idx" index
      qb.where('token.did', '=', search.did!),
    )
    .if(search.code !== undefined, (qb) =>
      // uses "token_code_idx" partial index (hence the null check)
      qb
        .where('token.code', '=', search.code!)
        .where('token.code', 'is not', null),
    )
    .if(search.tokenId !== undefined, (qb) =>
      // uses "token_token_id_idx"
      qb.where('token.tokenId', '=', search.tokenId!),
    )
    .if(search.currentRefreshToken !== undefined, (qb) =>
      // uses "token_refresh_token_unique_idx"
      qb.where('token.currentRefreshToken', '=', search.currentRefreshToken!),
    )
}

export const removeByDidQB = (db: AccountDb, did: string) =>
  // uses "token_did_idx" index
  db.db.deleteFrom('token').where('did', '=', did)

export const rotateQB = (
  db: AccountDb,
  id: number,
  newTokenId: TokenId,
  newRefreshToken: RefreshToken,
  newData: NewTokenData,
) =>
  db.db
    .updateTable('token')
    .set({
      tokenId: newTokenId,
      currentRefreshToken: newRefreshToken,

      expiresAt: toDateISO(newData.expiresAt),
      updatedAt: toDateISO(newData.updatedAt),
      clientAuth: toJson(newData.clientAuth),
      scope: newData.scope,
    })
    // uses primary key index
    .where('id', '=', id)

export const removeQB = (db: AccountDb, tokenId: TokenId) =>
  // uses "used_refresh_token_fk" to cascade delete
  db.db.deleteFrom('token').where('tokenId', '=', tokenId)
