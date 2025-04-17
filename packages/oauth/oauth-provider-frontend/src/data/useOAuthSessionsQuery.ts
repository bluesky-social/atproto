import { useQuery } from '@tanstack/react-query'
import { ActiveOAuthSession, useApi } from '#/api'

export type OAuthSessionsQueryInput = {
  sub: string
}

export const oauthSessionsQueryKey = ({ sub }: OAuthSessionsQueryInput) =>
  ['oauth-sessions', sub] as const

export function useOAuthSessionsQuery(input: OAuthSessionsQueryInput) {
  const api = useApi()
  return useQuery<ActiveOAuthSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: oauthSessionsQueryKey(input),
    queryFn: async (options) => {
      return await api.fetch('GET', '/oauth-sessions', input, options)
    },
  })
}
