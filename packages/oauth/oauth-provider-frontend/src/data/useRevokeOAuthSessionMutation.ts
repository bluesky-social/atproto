import { useMutation, useQueryClient } from '@tanstack/react-query'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'

export function useRevokeOAuthSessionMutation() {
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({ tokenId }: { sub: string; tokenId: string }) {
      await fetch(`/oauth/revoke`, {
        method: 'POST',
        credentials: 'include',
        body: new URLSearchParams({ token: tokenId }).toString(),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(input) })
    },
  })
}
