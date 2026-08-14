import { msg } from '@lingui/core/macro'
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import type {
  AccountSessionsInput,
  ActiveAccountSession,
  RevokeAccountSessionInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import type { Api } from '#/lib/api.ts'

export const accountSessionsQueryKey = ({ did }: AccountSessionsInput) =>
  ['account-sessions', did] as const

/**
 * @NOTE Takes `api` rather than reading it from a hook, so the route's loader
 * can prime this same query before the page renders.
 */
export const accountSessionsQueryOptions = (
  api: Api,
  { did }: AccountSessionsInput,
) =>
  queryOptions<ActiveAccountSession[]>({
    refetchOnWindowFocus: 'always',
    staleTime: 15e3, // 15s
    queryKey: accountSessionsQueryKey({ did }),
    queryFn: async ({ signal }) => {
      return api.accountSessions({ did }, { signal })
    },
  })

export function useAccountSessionsQuery(input: AccountSessionsInput) {
  const api = useApi()
  return useSuspenseQuery(accountSessionsQueryOptions(api, input))
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
