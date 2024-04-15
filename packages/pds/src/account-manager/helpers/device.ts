import { DeviceId, DeviceData } from '@atproto/oauth-provider'
import { AccountDb, Device } from '../db'
import { fromDateISO, toDateISO } from '../../db'
import { Selectable } from 'kysely'

const rowToDeviceData = (row: Selectable<Device>): DeviceData => ({
  sessionId: row.sessionId,
  userAgent: row.userAgent,
  ipAddress: row.ipAddress,
  lastSeenAt: fromDateISO(row.lastSeenAt),
})

/**
 * Future-proofs the session data by ensuring that only the expected fields are
 * present. If the @atproto/oauth-provider package adds new fields to the
 * DeviceData type, this function will throw an error.
 */
const futureProof = <T extends Partial<DeviceData>>(data: T): T => {
  const { sessionId, userAgent, ipAddress, lastSeenAt, ...rest } = data
  if (Object.keys(rest).length > 0) throw new Error('Unexpected fields')
  return { sessionId, userAgent, ipAddress, lastSeenAt } as T
}

export const create = async (
  db: AccountDb,
  deviceId: DeviceId,
  data: DeviceData,
) => {
  const { sessionId, userAgent, ipAddress, lastSeenAt } = futureProof(data)

  await db.db
    .insertInto('device')
    .values({
      id: deviceId,
      sessionId,
      userAgent,
      ipAddress,
      lastSeenAt: toDateISO(lastSeenAt),
    })
    .execute()
}

export const getById = async (db: AccountDb, deviceId: DeviceId) => {
  const row = await db.db
    .selectFrom('device')
    .where('id', '=', deviceId)
    .selectAll()
    .executeTakeFirst()

  if (row == null) return null

  return rowToDeviceData(row)
}

export const update = async (
  db: AccountDb,
  deviceId: DeviceId,
  data: Partial<DeviceData>,
) => {
  const { sessionId, userAgent, ipAddress, lastSeenAt } = futureProof(data)

  await db.db
    .updateTable('device')
    .if(sessionId != null, (qb) => qb.set({ sessionId }))
    .if(userAgent != null, (qb) => qb.set({ userAgent }))
    .if(ipAddress != null, (qb) => qb.set({ ipAddress }))
    .if(lastSeenAt != null, (qb) =>
      qb.set({ lastSeenAt: toDateISO(lastSeenAt!) }),
    )
    .where('id', '=', deviceId)
    .execute()
}

export const remove = async (db: AccountDb, deviceId: DeviceId) => {
  await db.db.deleteFrom('device').where('id', '=', deviceId).execute()
}
