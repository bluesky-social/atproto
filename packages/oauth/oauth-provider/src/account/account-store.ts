import type { Did } from '@atproto/did'
import type {
  Account,
  ConfirmAccountDeletionInput,
  ConfirmEmailUpdateInput,
  ConfirmEmailVerificationInput,
  ConfirmResetPasswordInput,
  DeactivateAccountInput,
  InitiateAccountDeletionInput,
  InitiateEmailUpdateInput,
  InitiateEmailUpdateOutput,
  InitiateEmailVerificationInput,
  InitiatePasswordResetInput,
  ReactivateAccountInput,
  UpdateHandleInput,
} from '@atproto/oauth-provider-api'
import type { OAuthScope } from '@atproto/oauth-types'
import type { HandleString } from '@atproto/syntax'
import type { ClientId } from '../client/client-id.js'
import type { DeviceId } from '../device/device-id.js'
import type { DeviceData } from '../device/device-store.js'
import type { HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import type { Awaitable } from '../lib/util/type.js'
import { buildInterfaceChecker } from '../lib/util/type.js'
import type {
  HandleUnavailableError,
  InvalidCredentialsError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
} from '../oauth-errors.js'
import type { InviteCode } from '../types/invite-code.js'
import type { SignUpInput } from './sign-up-input.js'

// Export all types needed to implement the AccountStore interface

export * from '../client/client-id.js'
export * from '../device/device-data.js'
export * from '../device/device-id.js'
export * from '../request/request-id.js'

export type {
  Account,
  Did,
  HandleString,
  HcaptchaVerifyResult,
  InviteCode,
  OAuthScope,
  SignUpInput,
}

export {
  HandleUnavailableError,
  InvalidCredentialsError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
}

export type ResetPasswordRequestInput = InitiatePasswordResetInput
export type ResetPasswordConfirmInput = ConfirmResetPasswordInput

export type UpdateEmailRequestInput = InitiateEmailUpdateInput
export type UpdateEmailRequestOutput = InitiateEmailUpdateOutput
export type UpdateEmailConfirmInput = ConfirmEmailUpdateInput
export type VerifyEmailRequestInput = InitiateEmailVerificationInput
export type VerifyEmailConfirmInput = ConfirmEmailVerificationInput
export type UpdateHandleData = UpdateHandleInput

export type DeactivateAccountData = DeactivateAccountInput
export type ReactivateAccountData = ReactivateAccountInput
export type DeleteAccountRequestInput = InitiateAccountDeletionInput
export type DeleteAccountConfirmInput = ConfirmAccountDeletionInput

export type CreateAccountData = {
  locale: string
  email: string
  password: string
  handle: HandleString
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
   * @throws {InvalidCredentialsError} - When the credentials are not valid.
   * Populate {@link InvalidCredentialsError.did} with the subject identifier
   * when the identifier matched an existing account (e.g. wrong password for
   * a known user); omit it when the identifier was not found. Throwing the
   * generic {@link InvalidRequestError} is also accepted for backward
   * compatibility but prevents the `onSignInFailed` hook from distinguishing
   * the two cases.
   * @throws {SecondAuthenticationFactorRequiredError} - To indicate that an {@link SecondAuthenticationFactorRequiredError.type} is required in the credentials
   */
  authenticateAccount(data: AuthenticateAccountData): Awaitable<Account>

  /**
   * Add a client & scopes to the list of authorized clients for the given account.
   */
  setAuthorizedClient(
    did: Did,
    clientId: ClientId,
    data: AuthorizedClientData,
  ): Awaitable<void>

  /**
   * @throws {InvalidRequestError} - When the credentials are not valid
   */
  getAccount(did: Did): Awaitable<{
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
  upsertDeviceAccount(deviceId: DeviceId, did: Did): Awaitable<void>

  /**
   * @param requestId - If provided, the result must either have the same
   * requestId, or not be bound to a particular requestId. If `null`, the
   * result must not be bound to a particular requestId.
   * @throws {InvalidRequestError} - Instead of returning `null` in order to
   * provide a custom error message
   */
  getDeviceAccount(
    deviceId: DeviceId,
    did: Did,
  ): Awaitable<DeviceAccount | null>

  /**
   * Removes *all* the unbound device-accounts associated with the given device
   * & account.
   *
   * @note Noop if the device-account is not found.
   */
  removeDeviceAccount(deviceId: DeviceId, did: Did): Awaitable<void>

  /**
   * @returns **all** the device accounts that match the {@link requestId}
   * criteria and given {@link filter}.
   */
  listDeviceAccounts(
    filter: { did: Did } | { deviceId: DeviceId },
  ): Awaitable<DeviceAccount[]>

  resetPasswordRequest(
    data: ResetPasswordRequestInput,
  ): Awaitable<null | Account>

  resetPasswordConfirm(
    data: ResetPasswordConfirmInput,
  ): Awaitable<null | Account>

  updateEmailRequest(
    data: UpdateEmailRequestInput,
  ): Awaitable<UpdateEmailRequestOutput>
  /**
   * Must trigger a verification email to be sent to the new email address, that
   * will then be confirmed through {@link updateEmailConfirm}. The account's
   * {@link Account['emailVerified'] emailVerified} field is expected to become
   * `false` until the new email is confirmed.
   */
  updateEmailConfirm(data: UpdateEmailConfirmInput): Awaitable<Account | null>

  verifyEmailRequest(data: VerifyEmailRequestInput): Awaitable<void>
  verifyEmailConfirm(data: VerifyEmailConfirmInput): Awaitable<Account | null>

  /**
   * @throws {HandleUnavailableError} - To indicate that the handle is already taken
   */
  verifyHandleAvailability(handle: HandleString): Awaitable<void>

  /**
   * @throws {HandleUnavailableError} - To indicate that the handle is already taken
   * @throws {InvalidRequestError} - To indicate that the handle is invalid or
   * cannot be used
   */
  updateHandle(data: UpdateHandleData): Awaitable<Account>

  /**
   * Mark the account as deactivated. The account remains recoverable. Should
   * be a no-op when the account is already deactivated.
   *
   * @throws {InvalidRequestError} - When the account cannot be deactivated
   * (e.g. unknown account)
   */
  deactivateAccount(data: DeactivateAccountData): Awaitable<Account>

  /**
   * Reactivate a previously-deactivated account. Should be a no-op when the
   * account is already active.
   *
   * @throws {InvalidRequestError} - When the account cannot be reactivated
   * (e.g. unknown account)
   */
  reactivateAccount(data: ReactivateAccountData): Awaitable<Account>

  /**
   * Initiate account deletion: typically sends a confirmation token to the
   * account's email address. The account is NOT deleted until
   * {@link deleteAccountConfirm} is called with the matching token and the
   * user's current password.
   */
  deleteAccountRequest(data: DeleteAccountRequestInput): Awaitable<void>

  /**
   * Finalize account deletion. Implementations MUST verify both the email
   * confirmation `token` issued by {@link deleteAccountRequest} and the user's
   * current `password` before deleting any data. Deletion is irreversible.
   *
   * @throws {InvalidRequestError} - When the token or password is invalid.
   */
  deleteAccountConfirm(data: DeleteAccountConfirmInput): Awaitable<void>
}

export const isAccountStore = buildInterfaceChecker<AccountStore>([
  'authenticateAccount',
  'createAccount',
  'deactivateAccount',
  'deleteAccountConfirm',
  'deleteAccountRequest',
  'getAccount',
  'getDeviceAccount',
  'listDeviceAccounts',
  'reactivateAccount',
  'removeDeviceAccount',
  'resetPasswordConfirm',
  'resetPasswordRequest',
  'setAuthorizedClient',
  'updateEmailConfirm',
  'updateEmailRequest',
  'updateHandle',
  'upsertDeviceAccount',
  'verifyEmailConfirm',
  'verifyEmailRequest',
  'verifyHandleAvailability',
])

export function asAccountStore<V>(implementation: V): V & AccountStore {
  if (!implementation || !isAccountStore(implementation)) {
    throw new Error('Invalid AccountStore implementation')
  }
  return implementation
}
