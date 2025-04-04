import { sql } from 'kysely'
import { DeviceAccountData, DeviceId } from '@atproto/oauth-provider'
import { toDateISO, toJson } from '../../db'
import { AccountDb } from '../db'
import { selectAccountQB } from './account'

export function upsertQB(
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
  data: DeviceAccountData,
) {
  const now = new Date()

  return db.db
    .insertInto('account_device')
    .values({
      did,
      deviceId,
      createdAt: toDateISO(now),
      updatedAt: toDateISO(now),
      data: toJson(data),
    })
    .onConflict((oc) =>
      // uses pk
      oc.columns(['deviceId', 'did']).doUpdateSet({
        updatedAt: toDateISO(now),
        data: toJson(data),
      }),
    )
}

export function selectQB(
  db: AccountDb,
  filter: {
    sub?: string
    deviceId?: DeviceId
  },
) {
  // Fool-proofing
  if (filter.sub == null && filter.deviceId == null) {
    throw new TypeError('Either did or deviceId must be provided')
  }

  return (
    selectAccountQB(db, { includeDeactivated: true })
      // note: query planner should use "account_device_pk" index
      .innerJoin('account_device', 'account_device.did', 'actor.did')
      .select([
        'account_device.deviceId',
        sql<null>`NULL`.as('requestId'),
        'account_device.createdAt as adCreatedAt',
        'account_device.updatedAt as adUpdatedAt',
        'account_device.data',
      ])
      .innerJoin('device', 'device.id', 'account_device.deviceId')
      .select([
        'device.sessionId',
        'device.userAgent',
        'device.ipAddress',
        'device.lastSeenAt',
      ])
      .if(filter.sub != null, (qb) => qb.where('actor.did', '=', filter.sub!))
      .if(filter.deviceId != null, (qb) =>
        qb.where('account_device.deviceId', '=', filter.deviceId!),
      )
  )
}

export function removeQB(db: AccountDb, deviceId: DeviceId, did: string) {
  return db.db
    .deleteFrom('account_device')
    .where('deviceId', '=', deviceId)
    .where('did', '=', did)
}
