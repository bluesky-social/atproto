import { useQuery } from '@tanstack/react-query'
import { useSignedInContext } from '../auth/auth-provider.tsx'

export function useGetSessionQuery() {
  const { agent } = useSignedInContext()

  return useQuery({
    queryKey: ['session', agent.assertDid],
    queryFn: async () => {
      const { data } = await agent.com.atproto.server.getSession()
      return data
    },
  })
}
