import {
  Code,
  FoundRequestResult,
  RequestData,
  RequestId,
  UpdateRequestData,
} from '@atproto/oauth-provider'
import { AccountDb, AuthorizationRequest } from '../db'
import { fromDateISO, fromJsonObject, toDateISO, toJsonObject } from '../../db'
import { Insertable, Selectable } from 'kysely'

export const rowToRequestData = (
  row: Selectable<AuthorizationRequest>,
): RequestData => ({
  clientId: row.clientId,
  clientAuth: fromJsonObject(row.clientAuth),
  parameters: fromJsonObject(row.parameters),
  expiresAt: fromDateISO(row.expiresAt),
  deviceId: row.deviceId,
  sub: row.did,
  code: row.code,
})

export const rowToFoundRequestResult = (
  row: Selectable<AuthorizationRequest>,
): FoundRequestResult => ({
  id: row.id,
  data: rowToRequestData(row),
})

const requestDataToRow = (
  id: RequestId,
  data: RequestData,
): Insertable<AuthorizationRequest> => ({
  id,
  did: data.sub,
  deviceId: data.deviceId,

  clientId: data.clientId,
  clientAuth: toJsonObject(data.clientAuth),
  parameters: toJsonObject(data.parameters),
  expiresAt: toDateISO(data.expiresAt),
  code: data.code,
})

export const createQB = (db: AccountDb, id: RequestId, data: RequestData) =>
  db.db.insertInto('authorization_request').values(requestDataToRow(id, data))

export const readQB = (db: AccountDb, id: RequestId) =>
  db.db.selectFrom('authorization_request').where('id', '=', id).selectAll()

export const updateQB = (
  db: AccountDb,
  id: RequestId,
  { code, sub, deviceId, expiresAt }: UpdateRequestData,
) =>
  db.db
    .updateTable('authorization_request')
    .if(code !== undefined, (qb) => qb.set({ code }))
    .if(sub !== undefined, (qb) => qb.set({ did: sub }))
    .if(deviceId !== undefined, (qb) => qb.set({ deviceId }))
    .if(expiresAt != null, (qb) => qb.set({ expiresAt: toDateISO(expiresAt!) }))
    .where('id', '=', id)

export const removeOldExpiredQB = (db: AccountDb, delay = 600e3) =>
  // We allow some delay for the expiration time so that expired requests
  // can still be returned to the OAuthProvider library for error handling.
  db.db
    .deleteFrom('authorization_request')
    // uses "authorization_request_expires_at_idx" index
    .where('expiresAt', '<', toDateISO(new Date(Date.now() - delay)))

export const removeByIdQB = (db: AccountDb, id: RequestId) =>
  db.db.deleteFrom('authorization_request').where('id', '=', id)

export const findByCodeQB = (db: AccountDb, code: Code) =>
  db.db
    .selectFrom('authorization_request')
    // uses "authorization_request_code_idx" partial index (hence the null check)
    .where('code', '=', code)
    .where('code', 'is not', null)
    .selectAll()
