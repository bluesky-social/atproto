import { msg } from '@lingui/core/macro'
import { useMutation } from '@tanstack/react-query'
import { UpdateHandleInput } from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import { apiErrorMessage } from '#/lib/api-error-parser'

export function useUpdateHandle() {
  const api = useApi()
  const { notify } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: UpdateHandleInput) {
      return api.updateHandle(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        variant: 'success',
        title: msg`Username updated`,
        description: msg`Your username has been updated.`,
      })
    },
    onError(error, _variables, _context) {
      console.error('Failed to update username', error)
      notify({
        variant: 'error',
        title: msg`Failed to update username`,
        description:
          apiErrorMessage(error) ??
          msg`Please check the username and try again.`,
      })
    },
  })
}
