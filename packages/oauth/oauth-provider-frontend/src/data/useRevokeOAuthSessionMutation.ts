import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApi } from '#/api'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({ token }: { did: string; token: string }) {
      // @ts-expect-error TODO
      return api.fetch('/revoke', {
        token,
      })
    },
    onSuccess(_, { did }) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(did) })
    },
  })
}
