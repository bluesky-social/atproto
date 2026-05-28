import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useMutation } from '@tanstack/react-query'
import {
  UpdateHandleInput,
  VerifyHandleAvailabilityInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { apiErrorMessage } from '#/lib/api-error-parser'

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
  const { _ } = useLingui()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: UpdateHandleInput) {
      return api.fetch('POST', '/update-handle', data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: _(msg`Username updated`),
        description: _(msg`Your username has been updated.`),
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to update username', error)
      notify({
        variant: 'error',
        title: _(msg`Failed to update username`),
        description: _(
          apiErrorMessage(error) ??
            msg`Please check the username and try again.`,
        ),
      })
    },
  })
}
