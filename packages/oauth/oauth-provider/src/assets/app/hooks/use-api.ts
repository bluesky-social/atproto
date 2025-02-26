import { useCallback, useMemo, useState } from 'react'
import { Session } from '../backend-data'
import {
  AcceptData,
  Api,
  ConfirmResetPasswordData,
  InitiatePasswordResetData,
  SessionResponse,
  SignInData,
  SignUpData,
  VerifyHandleAvailabilityData,
} from '../lib/api'
import { upsert } from '../lib/util'
import { useCsrfToken } from './use-csrf-token'

export type UseApiOptions = {
  requestUri: string
  sessions?: readonly Session[]
  newSessionsRequireConsent?: boolean
  onRedirected?: () => void
}

export function useApi({
  requestUri,
  sessions: sessionsInit = [],
  newSessionsRequireConsent = true,
  onRedirected,
}: UseApiOptions) {
  const csrfToken = useCsrfToken(`csrf-${requestUri}`)
  if (!csrfToken) throw new Error('CSRF token is missing')

  const api = useMemo(() => new Api(csrfToken), [csrfToken])
  const [sessions, setSessions] = useState(sessionsInit)

  const selectSub = useCallback(
    (sub: string | null) => {
      setSessions((sessions) =>
        sub === (sessions.find((s) => s.selected)?.account.sub || null)
          ? sessions
          : sessions.map((s) => ({ ...s, selected: s.account.sub === sub })),
      )
    },
    [setSessions],
  )

  const upsertSession = useCallback(
    ({ account, consentRequired }: SessionResponse) => {
      const session: Session = {
        account,
        selected: true,
        loginRequired: false,
        consentRequired: newSessionsRequireConsent || consentRequired,
      }

      setSessions((sessions) =>
        upsert(sessions, session, (s) => s.account.sub === account.sub).map(
          // Make sure to de-select any other selected session
          (s) => (s === session || !s.selected ? s : { ...s, selected: false }),
        ),
      )
    },
    [setSessions, newSessionsRequireConsent],
  )

  const performRedirect = useCallback(
    (url: URL) => {
      window.location.href = String(url)
      if (onRedirected) setTimeout(onRedirected)
    },
    [onRedirected],
  )

  const doSignIn = useCallback(
    async (data: SignInData, signal?: AbortSignal) => {
      const response = await api.fetch('/sign-in', data, { signal })
      upsertSession(response)
    },
    [api, upsertSession],
  )

  const doInitiatePasswordReset = useCallback(
    async (data: InitiatePasswordResetData, signal?: AbortSignal) => {
      await api.fetch('/reset-password-request', data, { signal })
    },
    [api],
  )

  const doConfirmResetPassword = useCallback(
    async (data: ConfirmResetPasswordData, signal?: AbortSignal) => {
      await api.fetch('/reset-password-confirm', data, { signal })
    },
    [api],
  )

  const doValidateNewHandle = useCallback(
    async (data: VerifyHandleAvailabilityData, signal?: AbortSignal) => {
      await api.fetch('/verify-handle-availability', data, { signal })
    },
    [api],
  )

  const doSignUp = useCallback(
    async (data: SignUpData, signal?: AbortSignal) => {
      const response = await api.fetch('/sign-up', data, { signal })
      upsertSession(response)
    },
    [api, upsertSession],
  )

  const doAccept = useCallback(
    async (data: AcceptData) => {
      performRedirect(api.buildAcceptUrl(data))
    },
    [api, performRedirect],
  )

  const doReject = useCallback(async () => {
    performRedirect(api.buildRejectUrl())
  }, [api, performRedirect])

  return {
    sessions,
    selectSub,

    doSignIn,
    doInitiatePasswordReset,
    doConfirmResetPassword,
    doValidateNewHandle,
    doSignUp,
    doAccept,
    doReject,
  }
}
