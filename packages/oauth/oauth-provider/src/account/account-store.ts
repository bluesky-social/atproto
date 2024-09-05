import z from 'zod'

import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Awaitable } from '../lib/util/type.js'
import { Sub } from '../oidc/sub.js'
import { Account } from './account.js'

export const signInCredentialsSchema = z.object({
  username: z.string(),
  siweSignature: z.string(),

  /**
   * If false, the account must not be returned from
   * {@link AccountStore.listDeviceAccounts}. Note that this only makes sense when
   * used with a device ID.
   */
  remember: z.boolean().optional().default(false),

  emailOtp: z.string().optional(),
})

export type SignInCredentials = z.TypeOf<typeof signInCredentialsSchema>

export type DeviceAccountInfo = {
  remembered: boolean
  authenticatedAt: Date
  authorizedClients: readonly ClientId[]
}

// Export all types needed to implement the AccountStore interface
export type { Account, DeviceId, Sub }

export type AccountInfo = {
  account: Account
  info: DeviceAccountInfo
}

export interface AccountStore {
  authenticateAccount(
    credentials: SignInCredentials,
    deviceId: DeviceId,
  ): Awaitable<AccountInfo | null>

  addAuthorizedClient(
    deviceId: DeviceId,
    sub: Sub,
    clientId: ClientId,
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
