import { useCallback, useMemo, useState } from 'react'

import { AuthorizeData } from '../backend-data'
import { SignInFormOutput } from '../components/sign-in-form'
import { Api } from '../lib/api'
import { Account, Session } from '../types'
import { useCsrfToken } from './use-csrf-token'
import { upsert } from '../lib/util'

export function useApi(
  {
    clientId,
    requestUri,
    csrfCookie,
    sessions: initialSessions,
    newSessionsRequireConsent,
  }: AuthorizeData,
  {
    onRedirected,
  }: {
    onRedirected?: () => void
  } = {},
) {
  const csrfToken = useCsrfToken(csrfCookie)
  const [sessions, setSessions] = useState<readonly Session[]>(initialSessions)

  const setSession = useCallback(
    (sub: string | null) => {
      setSessions((sessions) =>
        sub === (sessions.find((s) => s.selected)?.account.sub || null)
          ? sessions
          : sessions.map((s) => ({ ...s, selected: s.account.sub === sub })),
      )
    },
    [setSessions],
  )

  const api = useMemo(
    () => new Api(requestUri, clientId, csrfToken, newSessionsRequireConsent),
    [requestUri, clientId, csrfToken, newSessionsRequireConsent],
  )

  const performRedirect = useCallback(
    (url: URL) => {
      window.location.href = String(url)
      if (onRedirected) setTimeout(onRedirected)
    },
    [onRedirected],
  )

  const doSignIn = useCallback(
    async (credentials: SignInFormOutput): Promise<string> => {
      const session = await api.signIn(credentials)
      const { sub } = session.account

      setSessions((sessions) => {
        return upsert(sessions, session, (s) => s.account.sub === sub).map(
          // Make sure to de-select any other selected session
          (s) => (s === session || !s.selected ? s : { ...s, selected: false }),
        )
      })

      return sub
    },
    [api, performRedirect, clientId, setSessions],
  )

  const doAccept = useCallback(
    async (account: Account) => {
      performRedirect(await api.accept(account))
    },
    [api, performRedirect],
  )

  const doReject = useCallback(async () => {
    performRedirect(await api.reject())
  }, [api, performRedirect])

  return {
    sessions,
    setSession,

    doSignIn,
    doAccept,
    doReject,
  }
}
