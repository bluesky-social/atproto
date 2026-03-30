import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActiveOAuthSession,
  OAuthSessionsInput,
  RevokeOAuthSessionInput,
} from '@atproto/oauth-provider-api'
import { useApi } from '#/contexts/session.tsx'

export const oauthSessionsQueryKey = ({ sub }: OAuthSessionsInput) =>
  ['oauth-sessions', sub] as const

export function useOAuthSessionsQuery({ sub }: OAuthSessionsInput) {
  const api = useApi()
  return useQuery<ActiveOAuthSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: oauthSessionsQueryKey({ sub }),
    queryFn: async (options) => {
      return await api.fetch('GET', '/oauth-sessions', { sub }, options)
    },
  })
}

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({ sub, tokenId }: RevokeOAuthSessionInput) {
      await api.fetch('POST', '/revoke-oauth-session', { sub, tokenId })
    },
    onError(error, { sub }) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ sub }) })
    },
    onSuccess(_, { sub }) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ sub }) })
    },
  })
}
