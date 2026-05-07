import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccountSessionsInput,
  ActiveAccountSession,
  RevokeAccountSessionInput,
} from '@atproto/oauth-provider-api'
import { useApi } from '#/contexts/session'

export const accountSessionsQueryKey = ({ sub }: AccountSessionsInput) =>
  ['account-sessions', sub] as const

export function useAccountSessionsQuery({ sub }: AccountSessionsInput) {
  const api = useApi()

  return useQuery<ActiveAccountSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: accountSessionsQueryKey({ sub }),
    queryFn: async ({ signal }) => {
      return api.fetch('GET', '/account-sessions', { sub }, { signal })
    },
  })
}

export function useRevokeAccountSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({ sub, deviceId }: RevokeAccountSessionInput) {
      return api.fetch('POST', '/revoke-account-session', { sub, deviceId })
    },
    onSuccess(_, { sub }) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey({ sub }) })
    },
  })
}
