import { msg } from '@lingui/core/macro'
import { useMutation } from '@tanstack/react-query'
import type { UpdateHandleInput } from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'

export function useUpdateHandle() {
  const api = useApi()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: UpdateHandleInput) {
      return api.updateHandle(data)
    },
    onSuccess(_data, _variables, _context) {
      notify({
        title: msg`Username updated`,
        description: msg`Your username has been updated.`,
      })
    },
    onError(error, _variables, _context) {
      notifyError(error, {
        title: msg`Failed to update username`,
        description: msg`Please check the username and try again.`,
      })
    },
  })
}
