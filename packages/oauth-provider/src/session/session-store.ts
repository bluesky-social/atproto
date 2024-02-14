import { DeviceId } from '../device/device-id.js'
import { Awaitable } from '../util/awaitable.js'
import { SessionId, SessionData } from './session-data.js'

// Export all types needed to implement the SessionStore interface
export type { Awaitable, SessionId, DeviceId, SessionData }

export interface SessionStore {
  createDeviceSession(deviceId: DeviceId, data: SessionData): Awaitable<void>
  readDeviceSession(deviceId: DeviceId): Awaitable<SessionData | null>
  updateDeviceSession(
    deviceId: DeviceId,
    data: Partial<SessionData>,
  ): Awaitable<void>
  deleteDeviceSession(deviceId: DeviceId): Awaitable<void>
}

export function isSessionStore(
  implementation: Record<string, unknown> & Partial<SessionStore>,
): implementation is Record<string, unknown> & SessionStore {
  return (
    typeof implementation.createDeviceSession === 'function' &&
    typeof implementation.readDeviceSession === 'function' &&
    typeof implementation.updateDeviceSession === 'function' &&
    typeof implementation.deleteDeviceSession === 'function'
  )
}

export function asSessionStore(
  implementation?: Record<string, unknown> & Partial<SessionStore>,
): SessionStore {
  if (!implementation || !isSessionStore(implementation)) {
    throw new Error('Invalid SessionStore implementation')
  }
  return implementation
}
