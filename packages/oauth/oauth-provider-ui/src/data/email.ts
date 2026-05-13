import { useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import {
  ConfirmEmailUpdateInput,
  InitiateEmailUpdateInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { useCurrentLocale } from '#/locales/locale-provider.tsx'

export function useChangeEmailRequest() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()
  const locale = useCurrentLocale()

  return useMutation({
    async mutationFn(data: InitiateEmailUpdateInput) {
      return api.fetch('POST', '/update-email-request', {
        ...data,
        locale: data.locale ?? locale,
      })
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Email change request sent`,
        description: t`Check your inbox.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to request email change', error)
      notify({
        variant: 'error',
        title: t`Failed to request email change`,
        description: t`Please check the email address and try again.`,
      })
    },
  })
}

export function useUpdateEmailConfirm() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()
  const locale = useCurrentLocale()

  return useMutation({
    async mutationFn(data: ConfirmEmailUpdateInput) {
      return api.fetch('POST', '/update-email-confirm', {
        ...data,
        locale: data.locale ?? locale,
      })
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Email change successful`,
        description: t`You can now sign in with your new email.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to change email', error)
      notify({
        variant: 'error',
        title: t`Failed to change email`,
        description: t`Please check your reset code and try again.`,
      })
    },
  })
}
