import { DeviceAccountData, DeviceId, RequestId } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded } from '../../../db'

export interface AccountDeviceRequest {
  did: string
  deviceId: DeviceId
  requestId: RequestId

  createdAt: DateISO
  updatedAt: DateISO

  data: JsonEncoded<DeviceAccountData>
}

export const tableName = 'account_device_request'

export type PartialDB = { [tableName]: AccountDeviceRequest }
