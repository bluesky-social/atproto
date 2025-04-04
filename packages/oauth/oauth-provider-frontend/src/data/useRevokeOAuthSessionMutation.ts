import { useMutation, useQueryClient } from '@tanstack/react-query'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'

export function useRevokeOAuthSessionMutation() {
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(_input: { sub: string; tokenId: string }) {
      // @TODO
      throw new Error('NOT IMPLEMENTED')
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey(input) })
    },
  })
}
