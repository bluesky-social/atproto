import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import { DeviceData } from './device-data.js'
import { DeviceId } from './device-id.js'

// Export all types needed to implement the DeviceStore interface
export * from './device-data.js'
export * from './device-id.js'
export * from './session-id.js'

export type { Awaitable }

export interface DeviceStore {
  createDevice(deviceId: DeviceId, data: DeviceData): Awaitable<void>
  readDevice(deviceId: DeviceId): Awaitable<DeviceData | null>
  updateDevice(deviceId: DeviceId, data: Partial<DeviceData>): Awaitable<void>
  deleteDevice(deviceId: DeviceId): Awaitable<void>
}

export const isDeviceStore = buildInterfaceChecker<DeviceStore>([
  'createDevice',
  'readDevice',
  'updateDevice',
  'deleteDevice',
])

export function asDeviceStore<V>(implementation: V): V & DeviceStore {
  if (!implementation || !isDeviceStore(implementation)) {
    throw new Error('Invalid DeviceStore implementation')
  }
  return implementation
}
