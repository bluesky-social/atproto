import {
  Account,
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
} from '@atproto/oauth-provider-api'
import { OAuthScope } from '@atproto/oauth-types'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { DeviceData } from '../device/device-store.js'
import { HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import {
  HandleUnavailableError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
} from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { InviteCode } from '../types/invite-code.js'
import { SignUpInput } from './sign-up-input.js'

// Export all types needed to implement the AccountStore interface

export * from '../client/client-id.js'
export * from '../device/device-data.js'
export * from '../device/device-id.js'
export * from '../oidc/sub.js'
export * from '../request/request-id.js'

export type {
  Account,
  HcaptchaVerifyResult,
  InviteCode,
  OAuthScope,
  SignUpInput,
}

export {
  HandleUnavailableError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
}

export type ResetPasswordRequestInput = InitiatePasswordResetInput
export type ResetPasswordConfirmInput = ConfirmResetPasswordInput

export type CreateAccountData = {
  locale: string
  email: string
  password: string
  handle: string
  inviteCode?: string | undefined
}

export type AuthenticateAccountData = {
  locale: string
  password: string
  username: string
  emailOtp?: string | undefined
}

export type AuthorizedClientData = { authorizedScopes: readonly string[] }
export type AuthorizedClients = Map<ClientId, AuthorizedClientData>

export type DeviceAccount = {
  deviceId: DeviceId

  /**
   * The data associated with the device, created through the
   * {@link DeviceStore}. This data is used to identify devices on which a user
   * has logged in.
   */
  deviceData: DeviceData

  /**
   * The account associated with the device account.
   */
  account: Account

  /**
   * The list of clients that are authorized by the account, as created through
   * the {@link AccountStore.setAuthorizedClient} method.
   */
  authorizedClients: AuthorizedClients

  /**
   * The date at which the device account was created. This value is currently
   * not used.
   */
  createdAt: Date

  /**
   * The date at which the device account was last updated. This value is used
   * to determine the date at which the user last authenticated on a device
   */
  updatedAt: Date
}

export type SignUpData = SignUpInput & {
  hcaptchaResult?: HcaptchaVerifyResult
  inviteCode?: InviteCode
}

export interface AccountStore {
  /**
   * @throws {HandleUnavailableError} - To indicate that the handle is already taken
   * @throws {InvalidRequestError} - To indicate that some data is invalid
   */
  createAccount(data: CreateAccountData): Awaitable<Account>

  /**
   * @throws {InvalidRequestError} - When the credentials are not valid
   * @throws {SecondAuthenticationFactorRequiredError} - To indicate that an {@link SecondAuthenticationFactorRequiredError.type} is required in the credentials
   */
  authenticateAccount(data: AuthenticateAccountData): Awaitable<Account>

  /**
   * Add a client & scopes to the list of authorized clients for the given account.
   */
  setAuthorizedClient(
    sub: Sub,
    clientId: ClientId,
    data: AuthorizedClientData,
  ): Awaitable<void>

  /**
   * @throws {InvalidRequestError} - When the credentials are not valid
   */
  getAccount(sub: Sub): Awaitable<{
    account: Account
    authorizedClients: AuthorizedClients
  }>

  /**
   * @param data.requestId - If provided, the inserted account must be bound to
   * that particular requestId.
   *
   * @note Whenever a particular device account is created, all **unbound**
   * device accounts for the same `deviceId` & `sub` should be deleted.
   *
   * @note When a particular request is deleted (through
   * {@link RequestStore.deleteRequest}), all accounts bound to that request
   * should be deleted as well.
   */
  upsertDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<void>

  /**
   * @param requestId - If provided, the result must either have the same
   * requestId, or not be bound to a particular requestId. If `null`, the
   * result must not be bound to a particular requestId.
   * @throws {InvalidRequestError} - Instead of returning `null` in order to
   * provide a custom error message
   */
  getDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
  ): Awaitable<DeviceAccount | null>

  /**
   * Removes *all* the unbound device-accounts associated with the given device
   * & account.
   *
   * @note Noop if the device-account is not found.
   */
  removeDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<void>

  /**
   * @returns **all** the device accounts that match the {@link requestId}
   * criteria and given {@link filter}.
   */
  listDeviceAccounts(
    filter: { sub: Sub } | { deviceId: DeviceId },
  ): Awaitable<DeviceAccount[]>

  resetPasswordRequest(
    data: ResetPasswordRequestInput,
  ): Awaitable<null | Account>

  resetPasswordConfirm(
    data: ResetPasswordConfirmInput,
  ): Awaitable<null | Account>

  /**
   * @throws {HandleUnavailableError} - To indicate that the handle is already taken
   */
  verifyHandleAvailability(handle: string): Awaitable<void>
}

export const isAccountStore = buildInterfaceChecker<AccountStore>([
  'createAccount',
  'authenticateAccount',
  'setAuthorizedClient',
  'getAccount',
  'upsertDeviceAccount',
  'getDeviceAccount',
  'removeDeviceAccount',
  'listDeviceAccounts',
  'resetPasswordRequest',
  'resetPasswordConfirm',
  'verifyHandleAvailability',
])

export function asAccountStore<V>(implementation: V): V & AccountStore {
  if (!implementation || !isAccountStore(implementation)) {
    throw new Error('Invalid AccountStore implementation')
  }
  return implementation
}
