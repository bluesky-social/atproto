import type {
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
  SignInInput,
  SignUpInput,
} from '@atproto/oauth-provider-api'

export type HcaptchaVerifyData =
  | {
      action: 'sign-up'
      input: SignUpInput
    }
  | {
      action: 'sign-in'
      input: SignInInput
    }
  | {
      action: 'reset-password-request'
      input: InitiatePasswordResetInput
    }
  | {
      action: 'reset-password-confirm'
      input: ConfirmResetPasswordInput
    }
