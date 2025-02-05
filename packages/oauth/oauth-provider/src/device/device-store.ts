import { Awaitable } from '../lib/util/type.js'
import { DeviceData } from './device-data.js'
import { DeviceId } from './device-id.js'

// Export all types needed to implement the DeviceStore interface
export * from './device-id.js'
export * from './device-data.js'
export * from './session-id.js'

export interface DeviceStore {
  createDevice(deviceId: DeviceId, data: DeviceData): Awaitable<void>
  readDevice(deviceId: DeviceId): Awaitable<DeviceData | null>
  updateDevice(deviceId: DeviceId, data: Partial<DeviceData>): Awaitable<void>
  deleteDevice(deviceId: DeviceId): Awaitable<void>
}

export function isDeviceStore(
  implementation: Record<string, unknown> & Partial<DeviceStore>,
): implementation is Record<string, unknown> & DeviceStore {
  return (
    typeof implementation.createDevice === 'function' &&
    typeof implementation.readDevice === 'function' &&
    typeof implementation.updateDevice === 'function' &&
    typeof implementation.deleteDevice === 'function'
  )
}

export function asDeviceStore(
  implementation?: Record<string, unknown> & Partial<DeviceStore>,
): DeviceStore {
  if (!implementation || !isDeviceStore(implementation)) {
    throw new Error('Invalid DeviceStore implementation')
  }
  return implementation
}
