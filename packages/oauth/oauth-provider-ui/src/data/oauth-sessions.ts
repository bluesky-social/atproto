import { msg } from '@lingui/core/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ActiveOAuthSession,
  OAuthSessionsInput,
  RevokeOAuthSessionInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'

export const oauthSessionsQueryKey = ({ did }: OAuthSessionsInput) =>
  ['oauth-sessions', did] as const

export function useOAuthSessionsQuery({ did }: OAuthSessionsInput) {
  const api = useApi()
  return useQuery<ActiveOAuthSession[]>({
    refetchOnWindowFocus: 'always',
    // staleTime: 15e3, // 15s
    queryKey: oauthSessionsQueryKey({ did }),
    retry: 0,
    staleTime: 5e3,
    queryFn: async (options) => {
      return await api.oauthSessions({ did }, options)
    },
  })
}

export function useRevokeOAuthSessionMutation() {
  const api = useApi()
  const qc = useQueryClient()
  const { notify, notifyError } = useNotificationsContext()

  return useMutation({
    async mutationFn(data: RevokeOAuthSessionInput) {
      return api.revokeOAuthSession(data)
    },
    onSuccess(_data, { did }, _context) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ did }) })
      notify({
        title: msg`Successfully revoked access`,
        duration: 2e3,
      })
    },
    onError(error, { did }, _context) {
      qc.invalidateQueries({ queryKey: oauthSessionsQueryKey({ did }) })
      notifyError(error, {
        title: msg`Failed to revoke access`,
        duration: 2e3,
      })
    },
  })
}
