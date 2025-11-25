import { useQuery } from '@tanstack/react-query'
import * as com from '../lexicons/com.ts'
import { useAuthenticationContext } from '../providers/AuthenticationProvider.tsx'

export function useGetSessionQuery() {
  const { client } = useAuthenticationContext()

  return useQuery({
    queryKey: ['session', client.did],
    queryFn: async () => client.call(com.atproto.server.getSession),
  })
}
