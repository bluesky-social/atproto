import { DeviceId } from '@atproto/oauth-provider'
import { DateISO } from '../../../db'

export interface AccountDevice {
  did: string
  deviceId: DeviceId

  createdAt: DateISO
  updatedAt: DateISO
}

export const tableName = 'account_device'

export type PartialDB = { [tableName]: AccountDevice }
