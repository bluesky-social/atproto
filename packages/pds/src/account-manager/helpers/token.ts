import {
  AuthorizationDetails,
  Code,
  NewTokenData,
  RefreshToken,
  TokenData,
  TokenId,
  TokenInfo,
} from '@atproto/oauth-provider'
import { Insertable, Selectable } from 'kysely'
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

export const toInsertable = (
  tokenId: TokenId,
  data: TokenData,
  refreshToken?: RefreshToken,
): Insertable<Token> => ({
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

export const toTokenData = (
  row: Pick<ActorAccountToken, keyof ActorAccountToken & keyof Token>,
): TokenData => ({
  createdAt: fromDateISO(row.createdAt),
  expiresAt: fromDateISO(row.expiresAt),
  updatedAt: fromDateISO(row.updatedAt),
  clientId: row.clientId,
  clientAuth: fromJsonObject(row.clientAuth),
  deviceId: row.deviceId,
  sub: row.did,
  parameters: fromJsonObject(row.parameters),
  details: row.details
    ? fromJsonArray<AuthorizationDetails>(row.details)
    : null,
  code: row.code,
})

export const toTokenInfo = (
  row: ActorAccountToken,
  audience: string,
): TokenInfo => ({
  id: row.tokenId,
  data: toTokenData(row),
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
  selectAccountQB(db)
    .innerJoin('token', 'token.did', 'actor.did')
    .leftJoin('device_account', (join) =>
      join
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

export const create = async (
  db: AccountDb,
  tokenId: TokenId,
  data: TokenData,
  refreshToken?: RefreshToken,
) => {
  await db.db
    .insertInto('token')
    .values(toInsertable(tokenId, data, refreshToken))
    .execute()
}

export const getForRefresh = async (db: AccountDb, id: TokenId) => {
  return db.db
    .selectFrom('token')
    .where('tokenId', '=', id)
    .where('currentRefreshToken', 'is not', null)
    .select(['id', 'currentRefreshToken'])
    .executeTakeFirstOrThrow()
}

export const findBy = async (
  db: AccountDb,
  search: {
    tokenId?: TokenId
    id?: number
    currentRefreshToken?: RefreshToken
  },
  audience: string,
): Promise<null | TokenInfo> => {
  if (
    search.id === undefined &&
    search.tokenId === undefined &&
    search.currentRefreshToken === undefined
  ) {
    // Prevent accidental scan
    throw new Error('At least one search parameter is required')
  }

  const row = await selectTokenInfoQB(db)
    .if(search.id !== undefined, (qb) =>
      // primary key
      qb.where('token.id', '=', search.id!),
    )
    .if(search.tokenId !== undefined, (qb) =>
      // uses "token_token_id_idx"
      qb.where('token.tokenId', '=', search.tokenId!),
    )
    .if(search.currentRefreshToken !== undefined, (qb) =>
      // uses "token_refresh_token_unique_idx"
      qb.where('token.currentRefreshToken', '=', search.currentRefreshToken!),
    )
    .executeTakeFirst()

  if (!row) return null

  return toTokenInfo(row, audience)
}

export const rotate = async (
  db: AccountDb,
  id: number,
  newTokenId: TokenId,
  newRefreshToken: RefreshToken,
  newData: NewTokenData,
) => {
  const { expiresAt, updatedAt, clientAuth, ...rest } = newData

  // Future proofing
  if (Object.keys(rest).length > 0) throw new Error('Unexpected fields')

  await db.db
    .updateTable('token')
    .set({
      tokenId: newTokenId,
      currentRefreshToken: newRefreshToken,

      expiresAt: toDateISO(expiresAt),
      updatedAt: toDateISO(updatedAt),
      clientAuth: toJsonObject(clientAuth),
    })
    .where('id', '=', id)
    .execute()
}

export const remove = async (
  db: AccountDb,
  tokenId: TokenId,
): Promise<void> => {
  const row = await db.db
    .deleteFrom('token')
    .where('tokenId', '=', tokenId)
    .returning('id')
    .executeTakeFirst()

  if (!row) return

  // TODO: can use use foreign key constraint to delete this row ?
  await db.db
    .deleteFrom('used_refresh_token')
    .where('id', '=', row.id)
    .execute()
}

export const findByCode = async (
  db: AccountDb,
  code: Code,
  audience: string,
): Promise<null | TokenInfo> => {
  const row = await selectTokenInfoQB(db)
    .where('code', '=', code)
    .where('code', 'is not', null) // uses "token_code_idx"
    .executeTakeFirst()

  if (!row) return null
  return toTokenInfo(row, audience)
}
