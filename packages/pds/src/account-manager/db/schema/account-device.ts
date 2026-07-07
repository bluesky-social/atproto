import type { DeviceId } from '@atproto/oauth-provider/store'
import type { DateISO } from '../../../db/index.js'

export interface AccountDevice {
  did: string
  deviceId: DeviceId

  createdAt: DateISO
  updatedAt: DateISO
}

export const tableName = 'account_device'

export type PartialDB = { [tableName]: AccountDevice }
