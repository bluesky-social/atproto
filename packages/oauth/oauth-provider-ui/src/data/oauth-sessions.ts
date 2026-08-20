import { msg } from '@lingui/core/macro'
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import type {
  ActiveOAuthSession,
  OAuthSessionsInput,
  RevokeOAuthSessionInput,
} from '@atproto/oauth-provider-api'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { useApi } from '#/contexts/session.tsx'
import type { Api } from '#/lib/api.ts'

export const oauthSessionsQueryKey = ({ did }: OAuthSessionsInput) =>
  ['oauth-sessions', did] as const

/**
 * @NOTE Takes `api` rather than reading it from a hook, so the route's loader
 * can prime this same query before the page renders.
 */
export const oauthSessionsQueryOptions = (
  api: Api,
  { did }: OAuthSessionsInput,
) =>
  queryOptions<ActiveOAuthSession[]>({
    refetchOnWindowFocus: 'always',
    queryKey: oauthSessionsQueryKey({ did }),
    retry: 0,
    staleTime: 5e3,
    queryFn: async (options) => {
      return await api.oauthSessions({ did }, options)
    },
  })

export function useOAuthSessionsQuery(input: OAuthSessionsInput) {
  const api = useApi()
  return useSuspenseQuery(oauthSessionsQueryOptions(api, input))
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
