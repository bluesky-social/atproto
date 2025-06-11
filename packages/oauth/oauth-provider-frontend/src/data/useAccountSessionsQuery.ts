import { useQuery } from '@tanstack/react-query'
import { ActiveAccountSession, useApi } from '#/api'

export type UseAccountSessionsQueryInput = {
  sub: string
}

export const accountSessionsQueryKey = ({
  sub,
}: UseAccountSessionsQueryInput) => ['account-sessions', sub] as const

export function useAccountSessionsQuery(input: UseAccountSessionsQueryInput) {
  const api = useApi()

  return useQuery<ActiveAccountSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: accountSessionsQueryKey(input),
    queryFn: async (options) => {
      return api.fetch('GET', '/account-sessions', input, options)
    },
  })
}
