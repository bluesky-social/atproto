import { useQuery } from '@tanstack/react-query'

import { Account, useApi } from '#/api'
import { useAuthorizationData } from '#/data/useAuthorizationData'

export const useAccountsQueryKey = ['accounts']
export type UseAccountsQuery = ReturnType<typeof useAccountsQuery>
export type UseAccountsQueryResponse = Account[]

export function useAccountsQuery() {
  const api = useApi()
  const { sessions } = useAuthorizationData()

  return useQuery<UseAccountsQueryResponse>({
    initialData: sessions.map((s) => s.account),
    queryKey: ['accounts'],
    async queryFn() {
      const { accounts } = await api.fetch('/accounts', undefined)
      return accounts
    },
  })
}
