import type { Selectable } from 'kysely'
import type { DeviceId, SessionId } from '@atproto/oauth-provider/store'
import type { DateISO } from '../../../db/index.js'

export interface Device {
  id: DeviceId
  sessionId: SessionId

  userAgent: string | null
  ipAddress: string
  lastSeenAt: DateISO
}

export type DeviceEntry = Selectable<Device>

export const tableName = 'device'

export type PartialDB = { [tableName]: Device }
