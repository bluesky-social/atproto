import {
  Account,
  DeviceAccountInfo,
  DeviceId,
  OAuthClientId,
} from '@atproto/oauth-provider'
import { Insertable, Selectable } from 'kysely'

import { fromDateISO, fromJsonArray, toDateISO, toJsonArray } from '../../db'
import { AccountDb } from '../db'
import { DeviceAccount } from '../db/schema/device-account'
import { ActorAccount, selectAccountQB } from './account'

export type SelectableDeviceAccount = Pick<
  Selectable<DeviceAccount>,
  'authenticatedAt' | 'authorizedClients' | 'remember'
>

const selectAccountInfoQB = (db: AccountDb, deviceId: DeviceId) =>
  selectAccountQB(db)
    .innerJoin('device_account', 'device_account.did', 'actor.did')
    .innerJoin('device', 'device.id', 'device_account.deviceId')
    .where('device.id', '=', deviceId)
    .select([
      'device_account.authenticatedAt',
      'device_account.remember',
      'device_account.authorizedClients',
    ])

export type InsertableField = {
  authenticatedAt: Date
  authorizedClients: OAuthClientId[]
  remember: boolean
}

function toInsertable<V extends Partial<InsertableField>>(
  values: V,
): Pick<Insertable<DeviceAccount>, keyof V & keyof Insertable<DeviceAccount>>
function toInsertable(
  values: Partial<InsertableField>,
): Partial<Insertable<DeviceAccount>> {
  const row: Partial<Insertable<DeviceAccount>> = {}
  if (values.authenticatedAt) {
    row.authenticatedAt = toDateISO(values.authenticatedAt)
  }
  if (values.remember !== undefined) {
    row.remember = values.remember === true ? 1 : 0
  }
  if (values.authorizedClients) {
    row.authorizedClients = toJsonArray(values.authorizedClients)
  }
  return row
}

export function toDeviceAccountInfo(
  row: SelectableDeviceAccount,
): DeviceAccountInfo {
  return {
    remembered: row.remember === 1,
    authenticatedAt: fromDateISO(row.authenticatedAt),
    authorizedClients: fromJsonArray<OAuthClientId>(row.authorizedClients),
  }
}

export function toAccount(
  row: Selectable<ActorAccount>,
  audience: string,
): Account {
  return {
    sub: row.did,
    aud: audience,
    email: row.email || undefined,
    email_verified: row.email ? row.emailConfirmedAt != null : undefined,
    preferred_username: row.handle || undefined,
  }
}

export const getAuthorizedClients = async (
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
) => {
  const row = await db.db
    .selectFrom('device_account')
    .where('did', '=', did)
    .where('deviceId', '=', deviceId)
    .select('authorizedClients')
    .executeTakeFirstOrThrow()

  return fromJsonArray<OAuthClientId>(row.authorizedClients)
}

export const update = async (
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
  entry: {
    authenticatedAt?: Date
    authorizedClients?: OAuthClientId[]
    remember?: boolean
  },
): Promise<void> => {
  await db.db
    .updateTable('device_account')
    .set(toInsertable(entry))
    .where('did', '=', did)
    .where('deviceId', '=', deviceId)
    .execute()
}

export const createOrUpdate = async (
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
  remember: boolean,
) => {
  const { authorizedClients, ...values } = toInsertable({
    remember,
    authenticatedAt: new Date(),
    authorizedClients: [],
  })

  await db.db
    .insertInto('device_account')
    .values({ did, deviceId, authorizedClients, ...values })
    .onConflict((oc) => oc.columns(['deviceId', 'did']).doUpdateSet(values))
    .executeTakeFirstOrThrow()
}

export const get = async (
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
  audience: string,
) => {
  const row = await selectAccountInfoQB(db, deviceId)
    .where('actor.did', '=', did)
    .executeTakeFirst()

  if (!row) return null

  return {
    account: toAccount(row, audience),
    info: toDeviceAccountInfo(row),
  }
}

export const listRemembered = async (
  db: AccountDb,
  deviceId: DeviceId,
  audience: string,
) => {
  const rows = await selectAccountInfoQB(db, deviceId)
    .where('device_account.remember', '=', 1)
    .execute()

  return rows.map((row) => ({
    account: toAccount(row, audience),
    info: toDeviceAccountInfo(row),
  }))
}

export const remove = async (
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
) => {
  await db.db
    .deleteFrom('device_account')
    .where('deviceId', '=', deviceId)
    .where('did', '=', did)
    .execute()
}

export const removeByDevice = async (db: AccountDb, deviceId: DeviceId) => {
  await db.db
    .deleteFrom('device_account')
    .where('deviceId', '=', deviceId)
    .execute()
}
