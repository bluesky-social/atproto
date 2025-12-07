import { Query, useQuery } from '@tanstack/react-query'
import { TokenInfo } from '@atproto/oauth-client-browser'
import { useOAuthSession } from '../providers/OAuthProvider.tsx'

export function useGetTokenInfoQuery() {
  const session = useOAuthSession()
  return useQuery({
    queryKey: ['tokenInfo', session.did] as const,
    staleTime(query: Query<TokenInfo>) {
      const exp = query.state.data?.expiresAt
      if (!exp) return 0
      return exp.getTime() - Date.now()
    },
    refetchOnWindowFocus: true,
    queryFn: async (context): Promise<TokenInfo> => {
      const query = context.client
        .getQueryCache()
        .find<TokenInfo>({ queryKey: context.queryKey, exact: true })
      // The OAuthProvider will force a refresh of the token in the background
      // when initialized, so there is no point in forcing a refresh here during
      // initial load (ie. if there is no cache data yet)
      const forceRefresh = query?.state.data == null ? 'auto' : true
      return session.getTokenInfo(forceRefresh)
    },
  })
}
