import { OAuthClientId } from '@atproto/oauth-client-metadata'

import { DeviceId } from '../device/device-id.js'
import { Sub } from '../oidc/sub.js'
import { Awaitable } from '../util/awaitable.js'
import { Account } from './account.js'

export type LoginCredentials = {
  username: string
  password: string

  /**
   * If false, the account must not be returned from
   * {@link AccountStore.listDeviceAccounts}. Note that this only makes sense when
   * used with a device ID.
   */
  remember?: boolean
}

export type DeviceAccountInfo = {
  remembered: boolean
  authenticatedAt: Date
  authorizedClients: readonly OAuthClientId[]
}

// Export all types needed to implement the AccountStore interface
export type { Awaitable, Account, DeviceId, Sub }

export type AccountInfo = {
  account: Account
  info: DeviceAccountInfo
}

export interface AccountStore {
  authenticateAccount(
    credentials: LoginCredentials,
    deviceId: DeviceId,
  ): Awaitable<AccountInfo | null>

  addAuthorizedClient(
    deviceId: DeviceId,
    sub: Sub,
    clientId: OAuthClientId,
  ): Awaitable<void>

  getDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<AccountInfo | null>
  removeDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<void>

  /**
   * @note Only the accounts that where logged in with `remember: true` need to
   * be returned. The others will be ignored.
   */
  listDeviceAccounts(deviceId: DeviceId): Awaitable<AccountInfo[]>
}

export function isAccountStore(
  implementation: Record<string, unknown> & Partial<AccountStore>,
): implementation is Record<string, unknown> & AccountStore {
  return (
    typeof implementation.authenticateAccount === 'function' &&
    typeof implementation.getDeviceAccount === 'function' &&
    typeof implementation.addAuthorizedClient === 'function' &&
    typeof implementation.listDeviceAccounts === 'function' &&
    typeof implementation.removeDeviceAccount === 'function'
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
