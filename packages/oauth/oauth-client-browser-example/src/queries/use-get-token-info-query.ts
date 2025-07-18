import { useQuery } from '@tanstack/react-query'
import { useSignedInContext } from '../auth/auth-provider.tsx'

export function useGetTokenInfoQuery() {
  const { session } = useSignedInContext()
  return useQuery({
    queryKey: ['tokeninfo', session.did],
    queryFn: async () => session.getTokenInfo(),
  })
}
