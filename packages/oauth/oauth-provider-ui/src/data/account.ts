import { useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import {
  ConfirmAccountDeletionInput,
  DeactivateAccountInput,
  InitiateAccountDeletionInput,
  ReactivateAccountInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { WithOptionalLocale } from '#/lib/api.ts'

export function useDeactivateAccount() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: DeactivateAccountInput) {
      return api.deactivateAccount(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Account deactivated`,
        description: t`Your account is now deactivated.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to deactivate account', error)
      notify({
        variant: 'error',
        title: t`Failed to deactivate account`,
        description: t`Please try again in a moment.`,
      })
    },
  })
}

export function useReactivateAccount() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ReactivateAccountInput) {
      return api.reactivateAccount(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Account reactivated`,
        description: t`Your account is visible again.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to reactivate account', error)
      notify({
        variant: 'error',
        title: t`Failed to reactivate account`,
        description: t`Please try again in a moment.`,
      })
    },
  })
}

export function useDeleteAccountRequest() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: WithOptionalLocale<InitiateAccountDeletionInput>) {
      return api.deleteAccountRequest(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Confirmation email sent`,
        description: t`Check your inbox for the confirmation code.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to request account deletion', error)
      notify({
        variant: 'error',
        title: t`Failed to send confirmation email`,
        description: t`Please try again in a moment.`,
      })
    },
  })
}

export function useDeleteAccountConfirm() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmAccountDeletionInput) {
      return api.deleteAccountConfirm(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Account deleted`,
        description: t`Your account and all associated data have been deleted.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to delete account', error)
      notify({
        variant: 'error',
        title: t`Failed to delete account`,
        description: t`Please check your code and password, then try again.`,
      })
    },
  })
}
