import { msg } from '@lingui/core/macro'
import { useMutation } from '@tanstack/react-query'
import {
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { WithOptionalLocale } from '#/lib/api.ts'

export function useResetPasswordRequest() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: WithOptionalLocale<InitiatePasswordResetInput>) {
      return api.initiatePasswordReset(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Password reset email sent`,
        description: msg`Check your inbox.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to request password reset`,
        description: msg`Please check the email address and try again.`,
      })
    },
  })
}

export function useResetPasswordConfirm() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmResetPasswordInput) {
      return api.confirmResetPassword(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Password reset successful`,
        description: msg`You can now sign in with your new password.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to reset password`,
        description: msg`Please check your reset code and try again.`,
      })
    },
  })
}
