import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { z } from 'zod'
import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { Awaitable } from '../lib/util/type.js'
import {
  HandleUnavailableError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
} from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { Account } from './account.js'

// @NOTE Change the length here to force stronger passwords (through a reset)
export const oldPasswordSchema = z.string().min(1)
export const newPasswordSchema = z.string().min(8)
export const tokenSchema = z.string().regex(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/)
export const handleSchema = z
  .string()
  .min(3)
  .max(18)
  .regex(/^[a-z0-9][a-z0-9-]+[a-z0-9]$/)
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

export const authenticateAccountDataSchema = z
  .object({
    username: z.string(),
    password: oldPasswordSchema,
    emailOtp: z.string().optional(),
  })
  .strict()

export type AuthenticateAccountData = z.TypeOf<
  typeof authenticateAccountDataSchema
>

export const createAccountDataSchema = z
  .object({
    handle: handleSchema,
    email: emailSchema,
    password: z.intersection(oldPasswordSchema, newPasswordSchema),
    birthdate: z.string().date(),
    inviteCode: tokenSchema.optional(),
  })
  .strict()

export type CreateAccountData = z.TypeOf<typeof createAccountDataSchema>

export const resetPasswordRequestDataSchema = z
  .object({
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

export type DeviceAccountInfo = {
  remembered: boolean
  authenticatedAt: Date
  authorizedClients: readonly ClientId[]
}

// Export all types needed to implement the AccountStore interface
export {
  type Account,
  type DeviceId,
  HandleUnavailableError,
  InvalidRequestError,
  SecondAuthenticationFactorRequiredError,
  type Sub,
}

export type AccountInfo = {
  account: Account
  info: DeviceAccountInfo
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

  addAuthorizedClient(
    deviceId: DeviceId,
    sub: Sub,
    clientId: ClientId,
  ): Awaitable<void>

  /**
   * @param remember If false, the account must not be returned from
   * {@link AccountStore.listDeviceAccounts}.
   */
  addDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
    remember: boolean,
  ): Awaitable<DeviceAccountInfo>

  /**
   * @returns The account info, whether the account, even if remember was false.
   */
  getDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<AccountInfo | null>
  removeDeviceAccount(deviceId: DeviceId, sub: Sub): Awaitable<void>

  /**
   * @note Only the accounts that where logged in with `remember: true` need to
   * be returned. The others will be ignored.
   */
  listDeviceAccounts(deviceId: DeviceId): Awaitable<AccountInfo[]>

  resetPasswordRequest(data: ResetPasswordRequestData): Awaitable<void>
  resetPasswordConfirm(data: ResetPasswordConfirmData): Awaitable<void>

  /**
   * @throws {HandleUnavailableError} - To indicate that the handle is already taken
   */
  verifyHandleAvailability(handle: string): Awaitable<void>
}

export function isAccountStore(
  implementation: Record<string, unknown> & Partial<AccountStore>,
): implementation is Record<string, unknown> & AccountStore {
  return (
    typeof implementation.authenticateAccount === 'function' &&
    typeof implementation.addDeviceAccount === 'function' &&
    typeof implementation.getDeviceAccount === 'function' &&
    typeof implementation.addAuthorizedClient === 'function' &&
    typeof implementation.listDeviceAccounts === 'function' &&
    typeof implementation.removeDeviceAccount === 'function' &&
    typeof implementation.resetPasswordRequest === 'function' &&
    typeof implementation.resetPasswordConfirm === 'function' &&
    typeof implementation.verifyHandleAvailability === 'function'
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
