import { Selectable } from 'kysely'
import { DeviceData, DeviceId } from '@atproto/oauth-provider'
import { fromDateISO, toDateISO } from '../../db'
import { AccountDb, Device } from '../db'

export const rowToDeviceData = (
  row: Omit<Selectable<Device>, 'id'>,
): DeviceData => ({
  sessionId: row.sessionId,
  userAgent: row.userAgent,
  ipAddress: row.ipAddress,
  lastSeenAt: fromDateISO(row.lastSeenAt),
})

export const createQB = (
  db: AccountDb,
  deviceId: DeviceId,
  { sessionId, userAgent, ipAddress, lastSeenAt }: DeviceData,
) =>
  db.db.insertInto('device').values({
    id: deviceId,
    sessionId,
    userAgent,
    ipAddress,
    lastSeenAt: toDateISO(lastSeenAt),
  })

export const readQB = (db: AccountDb, deviceId: DeviceId) =>
  db.db.selectFrom('device').where('id', '=', deviceId).selectAll()

export const updateQB = (
  db: AccountDb,
  deviceId: DeviceId,
  { sessionId, userAgent, ipAddress, lastSeenAt }: Partial<DeviceData>,
) =>
  db.db
    .updateTable('device')
    .if(sessionId != null, (qb) => qb.set({ sessionId }))
    .if(userAgent != null, (qb) => qb.set({ userAgent }))
    .if(ipAddress != null, (qb) => qb.set({ ipAddress }))
    .if(lastSeenAt != null, (qb) =>
      qb.set({ lastSeenAt: toDateISO(lastSeenAt!) }),
    )
    .where('id', '=', deviceId)

export const removeQB = (db: AccountDb, deviceId: DeviceId) =>
  db.db.deleteFrom('device').where('id', '=', deviceId)
