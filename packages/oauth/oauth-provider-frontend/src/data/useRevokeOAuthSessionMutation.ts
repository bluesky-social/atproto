import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RevokeOAuthSessionInput, useApi } from '#/api'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(input: RevokeOAuthSessionInput) {
      await api.fetch('POST', '/revoke-oauth-session', input)
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(input) })
    },
  })
}
