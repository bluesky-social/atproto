import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { ActiveDeviceSession, useApi } from '#/api'
import { upsert } from '#/util/upsert'
import { useHydrationData } from './useHydrationData'

export const useDeviceSessionsQueryKey = ['device-sessions'] as const
export type UseAccountsQueryResponse = ActiveDeviceSession[]

/**
 * All accounts logged in on _this device_.
 */
export function useDeviceSessionsQuery() {
  const api = useApi()

  const initialData = useHydrationData('__deviceSessions')

  return useQuery<ActiveDeviceSession[]>({
    initialData: [...initialData],
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: useDeviceSessionsQueryKey,
    queryFn: async (options) => {
      return api.fetch('GET', '/device-sessions', undefined, options)
    },
  })
}

export function useUpsertDeviceAccount() {
  const qc = useQueryClient()

  return useCallback(
    (newSession: ActiveDeviceSession) => {
      return qc.setQueryData<ActiveDeviceSession[]>(
        useDeviceSessionsQueryKey,
        (data) =>
          upsert(
            data,
            newSession,
            (a) => a.account.sub === newSession.account.sub,
          ),
      )
    },
    [qc, ...useDeviceSessionsQueryKey],
  )
}
