import { DeviceAccountData, DeviceId } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db'

export interface AccountDevice {
  did: string
  deviceId: DeviceId

  createdAt: DateISO
  updatedAt: DateISO

  data: JsonEncoded<DeviceAccountData>
}

export const tableName = 'account_device'

export type PartialDB = { [tableName]: AccountDevice }
