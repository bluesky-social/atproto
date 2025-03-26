import type { OAuthClientMetadata } from '@atproto/oauth-types'
import type { Account, DeviceMetadata } from './types.js'

// These are the endpoints implemented by the OAuth provider, for it's UI to
// call.

export type ApiEndpoints = {
  '/verify-handle-availability': {
    method: 'POST'
    input: VerifyHandleAvailabilityData
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
    input: InitiatePasswordResetData
    output: { success: true }
  }
  '/reset-password-confirm': {
    method: 'POST'
    input: ConfirmResetPasswordData
    output: { success: true }
  }
  '/sign-out': {
    method: 'POST'
    input: { accounts: string[] }
    output: { success: true }
  }
  '/accounts': {
    method: 'GET'
    output: { accounts: Account[] }
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
    params: { account: string }
    output: {
      sessions: Array<{
        tokenId: string
        clientMetadata: OAuthClientMetadata
        deviceMetadata?: DeviceMetadata
      }>
    }
  }
  '/account-sessions': {
    method: 'GET'
    params: { account: string }
    output: {
      sessions: Array<{
        deviceId: string
        deviceMetadata: DeviceMetadata
      }>
    }
  }
  '/revoke-account-session': {
    method: 'POST'
    input: { account: string; deviceId: string }
    output: { success: true }
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

export type InitiatePasswordResetData = {
  locale: string
  email: string
}

export type ConfirmResetPasswordData = {
  token: string
  password: string
}

export type VerifyHandleAvailabilityData = {
  handle: string
}
