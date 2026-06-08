import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccountSessionsInput,
  ActiveAccountSession,
  RevokeAccountSessionInput,
} from '@atproto/oauth-provider-api'
import { useApi } from '#/contexts/session'

export const accountSessionsQueryKey = ({ did }: AccountSessionsInput) =>
  ['account-sessions', did] as const

export function useAccountSessionsQuery({ did }: AccountSessionsInput) {
  const api = useApi()

  return useQuery<ActiveAccountSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: accountSessionsQueryKey({ did }),
    queryFn: async ({ signal }) => {
      return api.accountSessions({ did }, { signal })
    },
  })
}

export function useRevokeAccountSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(data: RevokeAccountSessionInput) {
      await api.revokeAccountSession(data)
    },
    onSuccess(_, { did }) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey({ did }) })
    },
  })
}
