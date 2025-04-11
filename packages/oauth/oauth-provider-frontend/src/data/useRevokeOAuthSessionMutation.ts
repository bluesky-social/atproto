import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RevokeOAuthSessionInput, useApi } from '#/api'
import { oauthSessionsQueryKey } from './useOAuthSessionsQuery'

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(input: RevokeOAuthSessionInput) {
      await api.fetch('POST', '/revoke-oauth-session', input)
    },
    onError(error, input) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey(input) })
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey(input) })
    },
  })
}
