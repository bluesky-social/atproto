import { useLingui } from '@lingui/react/macro'
import { useCallback, useMemo, useState } from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import type {
  Account,
  ConfirmResetPasswordData,
  InitiatePasswordResetData,
  Session,
  SignInData,
  SignUpData,
  VerifyHandleAvailabilityData,
} from '@atproto/oauth-provider-api'
import { AcceptData, Api, UnknownRequestUriError } from '../lib/api.ts'
import { upsert } from '../lib/util.ts'
import { useCsrfToken } from './use-csrf-token.ts'

/**
 * Any function wrapped with this helper will automatically show the error
 * boundary when an `UnknownRequestUriError` is thrown. This typically happens
 * in development, or if the user left its browser session open for a (very)
 * long time.
 *
 * @note Requires an error boundary to be present in the component tree.
 */
function useSafeCallback<F extends (...a: any) => any>(fn: F, deps: unknown[]) {
  const { showBoundary } = useErrorBoundary<UnknownRequestUriError>()

  return useCallback(
    async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
      try {
        return await fn(...args)
      } catch (error) {
        if (error instanceof UnknownRequestUriError) showBoundary(error)
        throw error
      }
    },
    deps.concat(showBoundary),
  )
}

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

  const { i18n } = useLingui()
  const { locale } = i18n

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
    ({
      account,
      consentRequired,
    }: {
      account: Account
      consentRequired: boolean
    }) => {
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

  const doSignIn = useSafeCallback(
    async (data: Omit<SignInData, 'locale'>, signal?: AbortSignal) => {
      const response = await api.fetch(
        '/sign-in',
        { ...data, locale },
        { signal },
      )
      upsertSession(response)
    },
    [api, locale, upsertSession],
  )

  const doInitiatePasswordReset = useSafeCallback(
    async (
      data: Omit<InitiatePasswordResetData, 'locale'>,
      signal?: AbortSignal,
    ) => {
      await api.fetch(
        '/reset-password-request',
        { ...data, locale },
        { signal },
      )
    },
    [api, locale],
  )

  const doConfirmResetPassword = useSafeCallback(
    async (data: ConfirmResetPasswordData, signal?: AbortSignal) => {
      await api.fetch('/reset-password-confirm', data, { signal })
    },
    [api],
  )

  const doValidateNewHandle = useSafeCallback(
    async (data: VerifyHandleAvailabilityData, signal?: AbortSignal) => {
      await api.fetch('/verify-handle-availability', data, { signal })
    },
    [api],
  )

  const doSignUp = useSafeCallback(
    async (data: Omit<SignUpData, 'locale'>, signal?: AbortSignal) => {
      const response = await api.fetch(
        '/sign-up',
        { ...data, locale },
        { signal },
      )
      upsertSession(response)
    },
    [api, locale, upsertSession],
  )

  const doAccept = useSafeCallback(
    async (data: AcceptData) => {
      performRedirect(api.buildAcceptUrl(data))
    },
    [api, performRedirect],
  )

  const doReject = useSafeCallback(async () => {
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
