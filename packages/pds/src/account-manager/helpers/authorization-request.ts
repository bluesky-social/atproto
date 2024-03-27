import {
  Code,
  RequestData,
  RequestId,
  UpdateRequestData,
} from '@atproto/oauth-provider'
import { AccountDb, AuthorizationRequest } from '../db'
import { fromDateISO, fromJsonObject, toDateISO, toJsonObject } from '../../db'
import { Insertable, Selectable } from 'kysely'

const rowToRequestData = (
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

export const create = async (
  db: AccountDb,
  id: RequestId,
  data: RequestData,
) => {
  await db.db
    .insertInto('authorization_request')
    .values(requestDataToRow(id, data))
    .execute()
}

export const deleteOldExpired = async (db: AccountDb, delay = 600e3) => {
  // We allow some delay for the expiration time so that expired requests
  // can still be returned to the OauthProvider library for error handling.
  await db.db
    .deleteFrom('authorization_request')
    .where('expiresAt', '<', toDateISO(new Date(Date.now() - delay)))
    .execute()
}

export const get = async (db: AccountDb, id: RequestId) => {
  const row = await db.db
    .selectFrom('authorization_request')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (!row) return null
  return rowToRequestData(row)
}

export const update = async (
  db: AccountDb,
  id: RequestId,
  data: UpdateRequestData,
) => {
  const { code, sub, deviceId, expiresAt, ...rest } = data

  // Fool proof: in case the OauthProvider library is updated with new fields
  for (const k in rest) throw new Error(`Unexpected update field "${k}"`)

  await db.db
    .updateTable('authorization_request')
    .if(code !== undefined, (qb) => qb.set({ code }))
    .if(sub !== undefined, (qb) => qb.set({ did: sub }))
    .if(deviceId !== undefined, (qb) => qb.set({ deviceId }))
    .if(expiresAt != null, (qb) => qb.set({ expiresAt: toDateISO(expiresAt!) }))
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (db: AccountDb, id: RequestId) => {
  await db.db.deleteFrom('authorization_request').where('id', '=', id).execute()
}

export const findByCode = async (db: AccountDb, code: Code) => {
  const row = await db.db
    .selectFrom('authorization_request')
    .where('code', '=', code)
    .where('code', 'is not', null) // use "authorization_request_code_idx"
    .selectAll()
    .executeTakeFirst()

  if (!row) return null

  return {
    id: row.id,
    data: rowToRequestData(row),
  }
}
