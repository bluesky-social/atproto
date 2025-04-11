import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RevokeAccountSessionInput, useApi } from '#/api'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'
import { useDeviceSessionsQueryKey } from '#/data/useDeviceSessionsQuery'

export function useRevokeAccountSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(input: RevokeAccountSessionInput) {
      return api.fetch('POST', '/revoke-account-session', input)
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(input) })
      qc.invalidateQueries({ queryKey: useDeviceSessionsQueryKey })
    },
  })
}
