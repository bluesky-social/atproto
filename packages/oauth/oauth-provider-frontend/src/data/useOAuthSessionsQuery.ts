import { useQuery } from '@tanstack/react-query'

import { useApi } from '#/api'
import { ApiEndpoints } from '#/api/temp-types'

export type UseOAuthSessionsQueryResponse =
  ApiEndpoints['/oauth-sessions']['output']['sessions']

export function useOAuthSessionsQuery({ did }: { did: string }) {
  const api = useApi()
  return useQuery<ApiEndpoints['/oauth-sessions']['output']['sessions']>({
    queryKey: ['oauth-sessions', did],
    async queryFn() {
      const { sessions } = await api.fetch('/oauth-sessions', { account: did })
      return sessions
    },
  })
}
