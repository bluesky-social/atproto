import type { Awaitable } from '../lib/util/type.js'
import { buildInterfaceChecker } from '../lib/util/type.js'
import type { DeviceData } from './device-data.js'
import type { DeviceId } from './device-id.js'

// Export all types needed to implement the DeviceStore interface
export type * from './device-data.js'
export type { Awaitable, DeviceId }

export interface DeviceStore {
  createDevice(deviceId: DeviceId, data: DeviceData): Awaitable<void>
  readDevice(deviceId: DeviceId): Awaitable<DeviceData | null>
  updateDevice(deviceId: DeviceId, data: Partial<DeviceData>): Awaitable<void>
  deleteDevice(deviceId: DeviceId): Awaitable<void>
}

export const isDeviceStore = buildInterfaceChecker<DeviceStore>([
  'createDevice',
  'deleteDevice',
  'readDevice',
  'updateDevice',
])

export function asDeviceStore<V>(implementation: V): V & DeviceStore {
  if (!implementation || !isDeviceStore(implementation)) {
    throw new Error('Invalid DeviceStore implementation')
  }
  return implementation
}
