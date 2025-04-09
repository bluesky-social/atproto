import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { Account, DeviceMetadata, ISODateString } from './types.js'

// These are the endpoints implemented by the OAuth provider, for its UI to
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
  /**
   * Lists all the accounts that are currently active, on the current device.
   */
  '/device-sessions': {
    method: 'GET'
    output: { results: ActiveDeviceSession[] }
  }
  /**
   * Lists all the active OAuth sessions (access/refresh tokens) that where
   * issued to OAuth clients (apps).
   *
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
  '/revoke-oauth-session': {
    method: 'POST'
    input: RevokeOAuthSessionInput
    output: { success: true }
  }
  /**
   * Lists all the sessions that are currently active for a particular user, on
   * other devices.
   */
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

export type RevokeOAuthSessionInput = {
  sub: string
  tokenId: string
}

export type AcceptInput = {
  sub: string
}

export type RejectInput = Record<string, never>

/**
 * Represents an account that is currently signed-in to the Authorization
 * Server. If the session was created too long ago, the user may be required to
 * re-authenticate ({@link ActiveDeviceSession.loginRequired}).
 */
export type ActiveDeviceSession = {
  account: Account

  /**
   * The user checked the "remember me" checkbox when signing in. This means
   * that the session's expiration time is extended. When this is `false`, the
   * session will expire after a short time (15 minutes), and will not be
   * available anymore if the user closes the browser.
   */
  remembered: boolean

  /**
   * The session is too old and the user must re-authenticate.
   */
  loginRequired: boolean
}

/**
 * Represents another device on which an account is currently signed-in.
 */
export type ActiveAccountSession = {
  deviceId: string
  deviceMetadata: DeviceMetadata

  remembered: boolean

  isCurrentDevice: boolean
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
