import type { Account } from './types.js'

// These are the endpoints implemented by the OAuth provider, for it's UI to
// call.

export type ApiEndpoints = {
  '/verify-handle-availability': {
    input: VerifyHandleAvailabilityData
    output: { available: true }
  }
  '/sign-up': {
    input: SignUpData
    output: {
      account: Account
      consentRequired: boolean
    }
  }
  '/sign-in': {
    input: SignInData
    output: {
      account: Account
      consentRequired: boolean
    }
  }
  '/reset-password-request': {
    input: InitiatePasswordResetData
    output: { success: true }
  }
  '/reset-password-confirm': {
    input: ConfirmResetPasswordData
    output: { success: true }
  }
}

export type SignInData = {
  locale: string
  username: string
  password: string
  emailOtp?: string
  remember?: boolean
}

export type SignUpData = {
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
