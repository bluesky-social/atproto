import { useQuery } from '@tanstack/react-query'

import { useApi } from '#/api'
import { ApiEndpoints } from '#/api/temp-types'

export const accountSessionsQueryKey = (did: string) =>
  ['account-sessions', did] as const
export type UseAccountSessionsQueryResponse =
  ApiEndpoints['/account-sessions']['output']['sessions']

export function useAccountSessionsQuery({ did }: { did: string }) {
  const api = useApi()
  return useQuery<UseAccountSessionsQueryResponse>({
    queryKey: accountSessionsQueryKey(did),
    async queryFn() {
      const { sessions } = await api.fetch('/account-sessions', {
        account: did,
      })
      return sessions
    },
  })
}
