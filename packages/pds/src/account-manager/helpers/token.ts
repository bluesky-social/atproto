import { Selectable } from 'kysely'
import {
  Code,
  NewTokenData,
  OAuthAuthorizationDetail,
  RefreshToken,
  TokenData,
  TokenId,
  TokenInfo,
} from '@atproto/oauth-provider'
import {
  fromDateISO,
  fromJsonArray,
  fromJsonObject,
  toDateISO,
  toJsonArray,
  toJsonObject,
} from '../../db'
import { AccountDb, Token } from '../db'
import { ActorAccount, selectAccountQB } from './account'
import {
  SelectableDeviceAccount,
  toAccount,
  toDeviceAccountInfo,
} from './device-account'

type LeftJoined<T> = { [K in keyof T]: null | T[K] }

export type ActorAccountToken = Selectable<ActorAccount> &
  Selectable<Omit<Token, 'id' | 'did'>> &
  LeftJoined<SelectableDeviceAccount>

export const toTokenInfo = (
  row: ActorAccountToken,
  audience: string,
): TokenInfo => ({
  id: row.tokenId,
  data: {
    createdAt: fromDateISO(row.createdAt),
    expiresAt: fromDateISO(row.expiresAt),
    updatedAt: fromDateISO(row.updatedAt),
    clientId: row.clientId,
    clientAuth: fromJsonObject(row.clientAuth),
    deviceId: row.deviceId,
    sub: row.did,
    parameters: fromJsonObject(row.parameters),
    details: row.details
      ? fromJsonArray<OAuthAuthorizationDetail>(row.details)
      : null,
    code: row.code,
  },
  account: toAccount(row, audience),
  info:
    row.authenticatedAt != null &&
    row.authorizedClients != null &&
    row.remember != null
      ? toDeviceAccountInfo(row as SelectableDeviceAccount)
      : undefined,
  currentRefreshToken: row.currentRefreshToken,
})

const selectTokenInfoQB = (db: AccountDb) =>
  selectAccountQB(db, { includeDeactivated: true })
    // uses "token_did_idx" index (though unlikely in practice)
    .innerJoin('token', 'token.did', 'actor.did')
    .leftJoin('device_account', (join) =>
      join
        // uses "device_account_pk" index
        .on('device_account.did', '=', 'token.did')
        // @ts-expect-error "deviceId" is nullable in token
        .on('device_account.deviceId', '=', 'token.deviceId'),
    )
    .select([
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
      'device_account.authenticatedAt',
      'device_account.authorizedClients',
      'device_account.remember',
    ])

export const createQB = (
  db: AccountDb,
  tokenId: TokenId,
  data: TokenData,
  refreshToken?: RefreshToken,
) =>
  db.db.insertInto('token').values({
    tokenId,
    createdAt: toDateISO(data.createdAt),
    expiresAt: toDateISO(data.expiresAt),
    updatedAt: toDateISO(data.updatedAt),
    clientId: data.clientId,
    clientAuth: toJsonObject(data.clientAuth),
    deviceId: data.deviceId,
    did: data.sub,
    parameters: toJsonObject(data.parameters),
    details: data.details ? toJsonArray(data.details) : null,
    code: data.code,
    currentRefreshToken: refreshToken || null,
  })

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
    code?: Code
    tokenId?: TokenId
    currentRefreshToken?: RefreshToken
  },
) => {
  if (
    search.id === undefined &&
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
      clientAuth: toJsonObject(newData.clientAuth),
    })
    // uses primary key index
    .where('id', '=', id)

export const removeQB = (db: AccountDb, tokenId: TokenId) =>
  // uses "used_refresh_token_fk" to cascade delete
  db.db.deleteFrom('token').where('tokenId', '=', tokenId)
