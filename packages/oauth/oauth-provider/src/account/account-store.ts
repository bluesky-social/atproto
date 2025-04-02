import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { z } from 'zod'
import { Account } from '@atproto/oauth-provider-api'
import { OAuthScope } from '@atproto/oauth-types'
import { ensureValidHandle, normalizeHandle } from '@atproto/syntax'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { DeviceData } from '../device/device-store.js'
import { HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import { localeSchema } from '../lib/util/locale.js'
import { Awaitable, buildInterfaceChecker } from '../lib/util/type.js'
import {
  HandleUnavailableError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
} from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { RequestId } from '../request/request-id.js'
import { SignUpInput } from './sign-up-input.js'

// @NOTE Change the length here to force stronger passwords (through a reset)
export const oldPasswordSchema = z.string().min(1)
export const newPasswordSchema = z.string().min(8)
export const tokenSchema = z
  .string()
  .regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/, 'Invalid token format')
export const handleSchema = z
  .string()
  // @NOTE: We only check against validity towards ATProto's syntax. Additional
  // rules may be imposed by the store implementation.
  .superRefine((value, ctx) => {
    try {
      ensureValidHandle(value)
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid handle',
      })
    }
  })
  .transform(normalizeHandle)
export const emailSchema = z
  .string()
  .email()
  // @NOTE using @hapi/address here, in addition to the email() check to ensure
  // compatibility with the current email validation in the PDS's account
  // manager
  .refine(isEmailValid, {
    message: 'Invalid email address',
  })
  .refine((email) => !isDisposableEmail(email), {
    message: 'Disposable email addresses are not allowed',
  })
  .transform((value) => value.toLowerCase())
export const inviteCodeSchema = z.string().min(1)
export type InviteCode = z.infer<typeof inviteCodeSchema>

export const authenticateAccountDataSchema = z
  .object({
    locale: localeSchema,
    username: z.string(),
    password: oldPasswordSchema,
    emailOtp: tokenSchema.optional(),
  })
  .strict()

export type AuthenticateAccountData = z.TypeOf<
  typeof authenticateAccountDataSchema
>

export const createAccountDataSchema = z
  .object({
    locale: localeSchema,
    handle: handleSchema,
    email: emailSchema,
    password: z.intersection(oldPasswordSchema, newPasswordSchema),
    inviteCode: inviteCodeSchema.optional(),
  })
  .strict()

export type CreateAccountData = z.TypeOf<typeof createAccountDataSchema>

export const resetPasswordRequestDataSchema = z
  .object({
    locale: localeSchema,
    email: emailSchema,
  })
  .strict()

export type ResetPasswordRequestData = z.TypeOf<
  typeof resetPasswordRequestDataSchema
>

export const resetPasswordConfirmDataSchema = z
  .object({
    token: tokenSchema,
    password: z.intersection(oldPasswordSchema, newPasswordSchema),
  })
  .strict()

export type ResetPasswordConfirmData = z.TypeOf<
  typeof resetPasswordConfirmDataSchema
>

export type AuthorizedClientData = { authorizedScopes: readonly string[] }
export type AuthorizedClients = Map<ClientId, AuthorizedClientData>

export type DeviceAccountData = {
  remembered: boolean

  /**
   * If the session is "ephemeral" (i.e. not "remembered"), a cookie secret will
   * be stored in the device account (as a session cookie). This cookie secret
   * will be required to authenticate the device account in the future. This
   * mechanism is used to ensure that the ephemeral session cannot be used after
   * the device decided to forget the cookie.
   *
   * @note This value will typically be `null` if `remembered` is `true`.
   */
  ephemeralCookie: null | string
}

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
   * The requestId in the context of which the device account is being created.
   *
   * @note This value will typically be `null` if `remembered` is `true`.
   */
  requestId: null | RequestId

  /**
   * The date at which the device account was created. This value is used to
   * determine the expiration date of the device account.
   */
  createdAt: Date

  /**
   * The date at which the device account was last updated. This value is used
   * to determine the date at which the user last authenticated on a device
   */
  updatedAt: Date

  /**
   * The date at which the device account was last authenticated. This value
   * is used to determine the validity of the device account.
   */
  data: DeviceAccountData
}

export type SignUpData = SignUpInput & {
  hcaptchaResult?: HcaptchaVerifyResult
  inviteCode?: InviteCode
}

// Export all types needed to implement the AccountStore interface
export {
  type Account,
  type DeviceId,
  HandleUnavailableError,
  InvalidRequestError,
  type OAuthScope,
  type RequestId,
  SecondAuthenticationFactorRequiredError,
  type Sub,
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
  upsertDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
    requestId: RequestId | null,
    data: DeviceAccountData,
  ): Awaitable<void>

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
    requestId: null | RequestId,
  ): Awaitable<DeviceAccount | null>

  /**
   * Remove the device-accounts associated with the given requestId.
   *
   * @note Noop if the device-account is not found.
   */
  removeRequestDeviceAccounts(requestId: RequestId): Awaitable<void>

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
    /**
     * If provided, the results must either have the same `requestId`, or not be
     * bound to a particular `requestId` (`requestId == null`). If `null`, the
     * results must not be bound to a particular `requestId`:
     *
     * - input: `null` => output: `requestId == null`
     * - input: `"id"` => output: `requestId == null || requestId == "id"`
     */
    requestId: RequestId | null,
    filter: { sub: Sub } | { deviceId: DeviceId },
  ): Awaitable<DeviceAccount[]>

  resetPasswordRequest(data: ResetPasswordRequestData): Awaitable<void>
  resetPasswordConfirm(data: ResetPasswordConfirmData): Awaitable<void>

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
  'removeRequestDeviceAccounts',
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
