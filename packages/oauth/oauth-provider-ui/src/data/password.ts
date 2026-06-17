import { useLingui } from '@lingui/react/macro'
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
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: WithOptionalLocale<InitiatePasswordResetInput>) {
      return api.initiatePasswordReset(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Password reset email sent`,
        description: t`Check your inbox.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to request password reset', error)
      notify({
        variant: 'error',
        title: t`Failed to request password reset`,
        description: t`Please check the email address and try again.`,
      })
    },
  })
}

export function useResetPasswordConfirm() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmResetPasswordInput) {
      return api.confirmResetPassword(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Password reset successful`,
        description: t`You can now sign in with your new password.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to reset password', error)
      notify({
        variant: 'error',
        title: t`Failed to reset password`,
        description: t`Please check your reset code and try again.`,
      })
    },
  })
}
