import { Selectable } from 'kysely'
import { DeviceId, SessionId } from '@atproto/oauth-provider'
import { DateISO } from '../../../db'

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
