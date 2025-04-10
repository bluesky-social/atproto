import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { ActiveDeviceSession, useApi } from '#/api'
import { upsert } from '#/util/upsert'
import { useHydrationData } from './useHydrationData'

export const accountsQueryKey = ['device-sessions'] as const
export type UseAccountsQueryResponse = ActiveDeviceSession[]

export function useDeviceSessionsQuery() {
  const api = useApi()

  const initialData = useHydrationData('__deviceSessions')

  return useQuery<ActiveDeviceSession[]>({
    initialData: [...initialData],
    queryKey: accountsQueryKey,
    refetchOnWindowFocus: 'always',
    async queryFn({ signal }) {
      const { results } = await api.fetch(
        'GET',
        '/device-sessions',
        undefined,
        { signal },
      )
      return results
    },
  })
}

export function useUpsertDeviceAccount() {
  const qc = useQueryClient()

  return useCallback(
    (newSession: ActiveDeviceSession) => {
      return qc.setQueryData<ActiveDeviceSession[]>(accountsQueryKey, (data) =>
        upsert(
          data,
          newSession,
          (a) => a.account.sub === newSession.account.sub,
        ),
      )
    },
    [qc, ...accountsQueryKey],
  )
}
