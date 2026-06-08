import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActiveOAuthSession,
  OAuthSessionsInput,
  RevokeOAuthSessionInput,
} from '@atproto/oauth-provider-api'
import { useApi } from '#/contexts/session.tsx'

export const oauthSessionsQueryKey = ({ did }: OAuthSessionsInput) =>
  ['oauth-sessions', did] as const

export function useOAuthSessionsQuery({ did }: OAuthSessionsInput) {
  const api = useApi()
  return useQuery<ActiveOAuthSession[]>({
    refetchOnWindowFocus: 'always',
    // staleTime: 15e3, // 15s
    queryKey: oauthSessionsQueryKey({ did }),
    retry: 0,
    staleTime: 5e3,
    queryFn: async (options) => {
      return await api.oauthSessions({ did }, options)
    },
  })
}

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(data: RevokeOAuthSessionInput) {
      await api.revokeOAuthSession(data)
    },
    onError(error, { did }) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ did }) })
    },
    onSuccess(_, { did }) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ did }) })
    },
  })
}
