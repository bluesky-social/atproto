import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { Account, DeviceMetadata, ISODateString } from './types.js'

// These are the endpoints implemented by the OAuth provider, for it's UI to
// call.

export type ApiEndpoints = {
  '/verify-handle-availability': {
    method: 'POST'
    input: VerifyHandleAvailabilityInput
    output: { available: true }
  }
  '/sign-up': {
    method: 'POST'
    input: SignUpInput
    output: { account: Account }
  }
  '/sign-in': {
    method: 'POST'
    input: SignInInput
    output: { account: Account; consentRequired?: boolean }
  }
  '/reset-password-request': {
    method: 'POST'
    input: InitiatePasswordResetInput
    output: { success: true }
  }
  '/reset-password-confirm': {
    method: 'POST'
    input: ConfirmResetPasswordInput
    output: { success: true }
  }
  '/sign-out': {
    method: 'POST'
    input: { sub: string | string[] }
    output: { success: true }
  }
  '/accounts': {
    method: 'GET'
    output: { results: ActiveDeviceAccount[] }
  }
  /**
   * @NOTE can be revoked using the oauth revocation endpoint (json or form
   * encoded)
   *
   * ```http
   * POST /oauth/revoke
   * Content-Type: application/x-www-form-urlencoded
   *
   * token=<tokenId>
   * ```
   */
  '/oauth-sessions': {
    method: 'GET'
    params: { sub: string }
    output: { results: ActiveOAuthSession[] }
  }
  '/account-sessions': {
    method: 'GET'
    params: { sub: string }
    output: { results: ActiveAccountSession[] }
  }
  '/revoke-account-session': {
    method: 'POST'
    input: RevokeAccountSessionInput
    output: { success: true }
  }
  '/accept': {
    method: 'POST'
    input: AcceptInput
    output: { url: string }
  }
  '/reject': {
    method: 'POST'
    input: RejectInput
    output: { url: string }
  }
}

export type SignInInput = {
  locale: string
  username: string
  password: string
  emailOtp?: string
  remember?: boolean
}

export type SignUpInput = {
  locale: string
  handle: string
  email: string
  password: string
  inviteCode?: string
  hcaptchaToken?: string
}

export type InitiatePasswordResetInput = {
  locale: string
  email: string
}

export type ConfirmResetPasswordInput = {
  token: string
  password: string
}

export type VerifyHandleAvailabilityInput = {
  handle: string
}

export type RevokeAccountSessionInput = {
  sub: string
  deviceId: string
}

export type AcceptInput = {
  sub: string
}

export type RejectInput = Record<string, never>

/**
 * Represents an account that is currently signed-in to the Authorization
 * Server. If the session was created too long ago, the user may be required to
 * re-authenticate ({@link ActiveDeviceAccount.loginRequired}).
 */
export type ActiveDeviceAccount = {
  account: Account
  remembered: boolean
  loginRequired: boolean
}

/**
 * Represents another device on which an account is currently signed-in.
 */
export type ActiveAccountSession = {
  deviceId: string
  deviceMetadata: DeviceMetadata

  remembered: boolean
}

/**
 * Represents an active OAuth session (access token).
 */
export type ActiveOAuthSession = {
  tokenId: string

  createdAt: ISODateString
  updatedAt: ISODateString

  clientId: string
  /** An "undefined" value means that the client metadata could not be fetched */
  clientMetadata?: OAuthClientMetadata

  scope?: string
}
