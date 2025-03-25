import { useQuery } from '@tanstack/react-query'

import { Session } from '#/api'
import { useAuthorizationData } from '#/data/useAuthorizationData'

export function useAccountsQuery() {
  const { sessions } = useAuthorizationData()

  return useQuery<Session[]>({
    initialData: sessions,
    queryKey: ['accounts'],
    async queryFn() {
      return sessions
    },
  })
}
