import { OAuthClientId } from '@atproto/oauth-client-metadata'

import { DeviceId } from '../device/device-id.js'
import { DeviceData } from '../device/device-data.js'
import { Sub } from '../oidc/sub.js'
import { Awaitable } from '../util/awaitable.js'
import { Account } from './account.js'

export type LoginCredentials = {
  username: string
  password: string
}

export type SecondFactorMethod = {
  id: string
  type: 'email' | 'totp' | 'webauthn'
  data?: unknown
}

export type AuthenticationResult = {
  account: Account
  secondFactors?: readonly SecondFactorMethod[]
}

export type DeviceAccountData = {
  remembered: boolean
  authenticatedAt: Date
  secondFactorRequired: boolean
  authorizedClients: readonly OAuthClientId[]
}

// Export all types needed to implement the AccountStore interface
export type { Account, DeviceId, DeviceData, Sub }

export type DeviceAccount = {
  device: DeviceData
  account: Account

  data: DeviceAccountData
}

export interface AccountStore {
  authenticateAccount(
    credentials: LoginCredentials,
  ): Awaitable<AuthenticationResult | null>

  upsertDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
    data: DeviceAccountData,
  ): Awaitable<DeviceAccount>

  readDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
  ): Awaitable<DeviceAccount | null>

  updateDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
    data: Partial<DeviceAccountData>,
  ): Awaitable<DeviceAccount>

  deleteDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<void>

  listDeviceAccounts(deviceId: DeviceId): Awaitable<DeviceAccount[]>
}

export function isAccountStore(
  implementation: Record<string, unknown> & Partial<AccountStore>,
): implementation is Record<string, unknown> & AccountStore {
  return (
    typeof implementation.authenticateAccount === 'function' &&
    typeof implementation.readDeviceAccount === 'function' &&
    typeof implementation.addAuthorizedClient === 'function' &&
    typeof implementation.listDeviceAccounts === 'function' &&
    typeof implementation.deleteDeviceAccount === 'function'
  )
}

export function asAccountStore(
  implementation?: Record<string, unknown> & Partial<AccountStore>,
): AccountStore {
  if (!implementation || !isAccountStore(implementation)) {
    throw new Error('Invalid AccountStore implementation')
  }
  return implementation
}
