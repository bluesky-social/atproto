import { DeviceAccountData, DeviceId, RequestId } from '@atproto/oauth-provider'
import { toDateISO, toJson } from '../../db'
import { AccountDb } from '../db'
import { selectAccountQB } from './account'

export function upsertQB(
  db: AccountDb,
  deviceId: DeviceId,
  did: string,
  requestId: RequestId,
  data: DeviceAccountData,
) {
  const now = new Date()

  return db.db
    .insertInto('account_device_request')
    .values({
      did,
      deviceId,
      requestId,
      createdAt: toDateISO(now),
      updatedAt: toDateISO(now),
      data: toJson(data),
    })
    .onConflict((oc) =>
      // uses pk
      oc.columns(['did', 'deviceId', 'requestId']).doUpdateSet({
        updatedAt: toDateISO(now),
        data: toJson(data),
      }),
    )
}

export function selectQB(
  db: AccountDb,
  requestId: RequestId,
  filter: {
    sub?: string
    deviceId?: DeviceId
  },
) {
  // Fool-proofing
  if (filter.sub == null && filter.deviceId == null) {
    throw new TypeError('Either sub or deviceId must be provided')
  }

  return (
    selectAccountQB(db, { includeDeactivated: true })
      // note: query planner should use "account_device_request_pk" index
      .innerJoin(
        'account_device_request',
        'account_device_request.did',
        'actor.did',
      )
      .select([
        'account_device_request.deviceId',
        'account_device_request.requestId',
        'account_device_request.createdAt as adCreatedAt',
        'account_device_request.updatedAt as adUpdatedAt',
        'account_device_request.data',
      ])
      .innerJoin('device', 'device.id', 'account_device_request.deviceId')
      .select([
        'device.sessionId',
        'device.userAgent',
        'device.ipAddress',
        'device.lastSeenAt',
      ])
      .where('account_device_request.requestId', '=', requestId)
      .if(filter.sub != null, (qb) => qb.where('actor.did', '=', filter.sub!))
      .if(filter.deviceId != null, (qb) =>
        qb.where('account_device_request.deviceId', '=', filter.deviceId!),
      )
  )
}

export function deleteByRequestIdQB(db: AccountDb, requestId: RequestId) {
  return db.db
    .deleteFrom('account_device_request')
    .where('requestId', '=', requestId)
}
