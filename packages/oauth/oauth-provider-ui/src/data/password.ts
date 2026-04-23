import { useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import {
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { Override } from '#/lib/util.ts'
import { useCurrentLocale } from '#/locales/locale-provider.tsx'

export function useResetPasswordRequest() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()
  const currentLocale = useCurrentLocale()

  return useMutation({
    async mutationFn({
      locale = currentLocale,
      email,
    }: Override<InitiatePasswordResetInput, { locale?: string }>) {
      return api.fetch('POST', '/reset-password-request', { locale, email })
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
    async mutationFn({ token, password }: ConfirmResetPasswordInput) {
      return api.fetch('POST', '/reset-password-confirm', { token, password })
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
