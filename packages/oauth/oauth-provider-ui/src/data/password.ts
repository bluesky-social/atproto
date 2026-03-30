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
        description: t`Your password has been reset successfully. You can now sign in with your new password.`,
      })
    },
  })
}
