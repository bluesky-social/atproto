import { useLingui } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import {
  UpdateHandleInput,
  VerifyHandleAvailabilityInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'

export function useVerifyHandleAvailability() {
  const api = useApi()

  return useMutation({
    async mutationFn(data: VerifyHandleAvailabilityInput) {
      return api.fetch('POST', '/verify-handle-availability', data)
    },
  })
}

export function useUpdateHandle() {
  const api = useApi()
  const { t } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: UpdateHandleInput) {
      return api.fetch('POST', '/update-handle', data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: t`Username updated`,
        description: t`Your username has been updated.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to update username', error)
      notify({
        variant: 'error',
        title: t`Failed to update username`,
        description: t`Please check the username and try again.`,
      })
    },
  })
}
