import { msg } from '@lingui/core/macro'
import { useMutation } from '@tanstack/react-query'
import type {
  ConfirmEmailUpdateInput,
  ConfirmEmailVerificationInput,
  DisableEmailAuthFactorInput,
  EnableEmailAuthFactorInput,
  InitiateEmailUpdateInput,
  InitiateEmailVerificationInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'

export function useUpdateEmailRequest() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: InitiateEmailUpdateInput) {
      return api.updateEmailRequest(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Email change request sent`,
        description: msg`Check your inbox.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to request email change`,
        description: msg`Please check the email address and try again.`,
      })
    },
  })
}

export function useUpdateEmailConfirm() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmEmailUpdateInput) {
      return api.updateEmailConfirm(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Email change successful`,
        description: msg`You can now sign in with your new email.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to change email`,
        description: msg`Please check your reset code and try again.`,
      })
    },
  })
}

export function useVerifyEmailRequest() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: InitiateEmailVerificationInput) {
      return api.verifyEmailRequest(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Verification email sent`,
        description: msg`Check your inbox for the verification code.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to send verification email`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}

export function useVerifyEmailConfirm() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmEmailVerificationInput) {
      return api.verifyEmailConfirm(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Email verified`,
        description: msg`Your email address has been verified.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to verify email`,
        description: msg`Please check your verification code and try again.`,
      })
    },
  })
}

export function useEnableEmailAuthFactor() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: EnableEmailAuthFactorInput) {
      return api.enableEmailAuthFactor(data)
    },
    onSuccess(data, _variables, _context) {
      // Email-based enable has no confirmation step (`tokenRequired` is always
      // false); the guard keeps this correct if a future factor adds one.
      if (!data.tokenRequired) {
        notify({
          title: msg`Email login verification enabled`,
          description: msg`Your next login will require a code that is sent to your email address.`,
        })
      }
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to enable email login verification`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}

export function useDisableEmailAuthFactor() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: DisableEmailAuthFactorInput) {
      return api.disableEmailAuthFactor(data)
    },
    onSuccess(data, _variables, _context) {
      // `tokenRequired` is false once the factor is actually off — either the
      // confirming call with a valid token, or a no-token call that found it
      // already disabled (e.g. a stale second tab). While an OTP is pending
      // (`tokenRequired: true`) the dialog advances to the code-entry step and
      // we stay quiet.
      if (!data.tokenRequired) {
        notify({
          title: msg`Email login verification disabled`,
          description: msg`You will no longer be prompted for a code to sign in.`,
        })
      }
    },
    onError(error, variables, _context) {
      notifyError(error, {
        title: variables.token
          ? msg`Failed to disable email login verification`
          : msg`Failed to send security code`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}
