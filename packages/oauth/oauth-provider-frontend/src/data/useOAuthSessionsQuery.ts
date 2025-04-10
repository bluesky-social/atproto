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
    queryKey: oauthSessionsQueryKey(input),
    refetchOnWindowFocus: 'always',
    async queryFn({ signal }) {
      const { results } = await api.fetch('GET', '/oauth-sessions', input, {
        signal,
      })
      return results
    },
  })
}
