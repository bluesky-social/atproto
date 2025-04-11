import assert from 'node:assert'
import { DeviceId } from '@atproto/oauth-provider'
import { toDateISO } from '../../db'
import { AccountDb } from '../db'
import { selectAccountQB } from './account'

export function upsertQB(db: AccountDb, deviceId: DeviceId, did: string) {
  const now = new Date()

  return db.db
    .insertInto('account_device')
    .values({
      did,
      deviceId,
      createdAt: toDateISO(now),
      updatedAt: toDateISO(now),
    })
    .onConflict((oc) =>
      // uses pk
      oc.columns(['deviceId', 'did']).doUpdateSet({
        updatedAt: toDateISO(now),
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
  assert(
    filter.sub != null || filter.deviceId != null,
    'Either sub or deviceId must be provided',
  )

  return (
    selectAccountQB(db, { includeDeactivated: true })
      // note: query planner should use "account_device_pk" index
      .innerJoin('account_device', 'account_device.did', 'actor.did')
      .select([
        'account_device.deviceId',
        'account_device.createdAt as adCreatedAt',
        'account_device.updatedAt as adUpdatedAt',
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
