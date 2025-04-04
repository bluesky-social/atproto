import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApi } from '#/api'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'

export function useRevokeAccountSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({ did, deviceId }: { did: string; deviceId: string }) {
      return api.fetch('/revoke-account-session', {
        account: did,
        deviceId,
      })
    },
    onSuccess(_, { did }) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(did) })
    },
  })
}
