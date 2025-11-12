import { useQuery } from '@tanstack/react-query'
import { useOAuthSession } from '../providers/OAuthProvider.tsx'

export function useGetTokenInfoQuery() {
  const session = useOAuthSession()
  return useQuery({
    queryKey: ['tokenInfo', session.did],
    queryFn: async () => session.getTokenInfo(true),
  })
}
