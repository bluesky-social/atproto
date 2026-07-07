import { msg } from '@lingui/core/macro'
import { useMutation } from '@tanstack/react-query'
import type {
  ConfirmAccountDeletionInput,
  DeactivateAccountInput,
  InitiateAccountDeletionInput,
  ReactivateAccountInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import type { WithOptionalLocale } from '#/lib/api.ts'

export function useDeactivateAccount() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: DeactivateAccountInput) {
      return api.deactivateAccount(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Account deactivated`,
        description: msg`Your account is now deactivated.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to deactivate account`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}

export function useReactivateAccount() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ReactivateAccountInput) {
      return api.reactivateAccount(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Account reactivated`,
        description: msg`Your account is visible again.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to reactivate account`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}

export function useDeleteAccountRequest() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: WithOptionalLocale<InitiateAccountDeletionInput>) {
      return api.deleteAccountRequest(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Confirmation email sent`,
        description: msg`Check your inbox for the confirmation code.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to send confirmation email`,
        description: msg`Please try again in a moment.`,
      })
    },
  })
}

export function useDeleteAccountConfirm() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: ConfirmAccountDeletionInput) {
      return api.deleteAccountConfirm(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Account deleted`,
        description: msg`Your account and all associated data have been deleted.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to delete account`,
        description: msg`Please check your code and password, then try again.`,
      })
    },
  })
}
