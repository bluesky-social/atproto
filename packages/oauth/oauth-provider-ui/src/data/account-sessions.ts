import { msg } from '@lingui/core/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccountSessionsInput,
  ActiveAccountSession,
  RevokeAccountSessionInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'

export const accountSessionsQueryKey = ({ did }: AccountSessionsInput) =>
  ['account-sessions', did] as const

export function useAccountSessionsQuery({ did }: AccountSessionsInput) {
  const api = useApi()

  return useQuery<ActiveAccountSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: accountSessionsQueryKey({ did }),
    queryFn: async ({ signal }) => {
      return api.accountSessions({ did }, { signal })
    },
  })
}

export function useRevokeAccountSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: RevokeAccountSessionInput) {
      return api.revokeAccountSession(data)
    },
    onSuccess(_data, { did }, _context) {
      qc.invalidateQueries({ queryKey: accountSessionsQueryKey({ did }) })
      notify({ title: msg`Successfully removed device` })
    },
    onError(error, _variables, _context) {
      notifyError(error, { title: msg`Failed to remove device` })
    },
  })
}
