import { useLingui } from '@lingui/react/macro'
import { useCallback, useState } from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import type {
  Account,
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
  Session,
  SignInInput,
  SignUpInput,
  VerifyHandleAvailabilityInput,
} from '@atproto/oauth-provider-api'
import { Api, UnknownRequestUriError } from '../lib/api.ts'
import { upsert } from '../lib/util.ts'

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

export type SessionWithToken = Session & {
  ephemeralToken?: string
}

export function useApi({
  sessions: sessionsInit = [],
  onRedirected,
}: {
  sessions?: readonly Session[]
  onRedirected?: () => void
}) {
  const [api] = useState(() => new Api())
  const [sessions, setSessions] =
    useState<readonly SessionWithToken[]>(sessionsInit)

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
      ephemeralToken,
      // The server will tell us if the user needs to consent to the
      // authorization. Defaults to true in case of sign-ups
      consentRequired = true,
      // When a new session is inserted, assume that the user intends to use
      // it, and therefore, it is selected by default.
      selected = true,
      // When a new session is inserted, it is assumed that the user just
      // created the session, and therefore, login is not required.
      loginRequired = false,
    }: { account: Account } & Partial<SessionWithToken>) => {
      const session: SessionWithToken = {
        account,
        ephemeralToken,
        selected,
        loginRequired,
        consentRequired,
      }

      setSessions((sessions) =>
        upsert(sessions, session, (s) => s.account.sub === account.sub).map(
          // Make sure to de-select any other selected session (if selected is
          // true)
          (s) =>
            !selected || s === session || !s.selected
              ? s
              : { ...s, selected: false },
        ),
      )
    },
    [setSessions],
  )

  const performRedirect = useCallback(
    (url: string | URL) => {
      // @TODO At this point, the request cannot be accepted/rejected anymore.
      // We should probably change the app's state to something that indicates
      // that in order to improve UX in case the user comes back to the app.
      // This is currently ensured by the backend (through back-forward cache
      // busting) but handling it here would provide a better UX.

      window.location.href = String(url)
      if (onRedirected) setTimeout(onRedirected)
    },
    [onRedirected],
  )

  const doSignIn = useSafeCallback(
    async (data: Omit<SignInInput, 'locale'>, signal?: AbortSignal) => {
      const response = await api.fetch(
        'POST',
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
      data: Omit<InitiatePasswordResetInput, 'locale'>,
      signal?: AbortSignal,
    ) => {
      await api.fetch(
        'POST',
        '/reset-password-request',
        { ...data, locale },
        { signal },
      )
    },
    [api, locale],
  )

  const doConfirmResetPassword = useSafeCallback(
    async (data: ConfirmResetPasswordInput, signal?: AbortSignal) => {
      await api.fetch('POST', '/reset-password-confirm', data, { signal })
    },
    [api],
  )

  const doValidateNewHandle = useSafeCallback(
    async (data: VerifyHandleAvailabilityInput, signal?: AbortSignal) => {
      await api.fetch('POST', '/verify-handle-availability', data, { signal })
    },
    [api],
  )

  const doSignUp = useSafeCallback(
    async (data: Omit<SignUpInput, 'locale'>, signal?: AbortSignal) => {
      const response = await api.fetch(
        'POST',
        '/sign-up',
        { ...data, locale },
        { signal },
      )
      upsertSession(response)
    },
    [api, locale, upsertSession],
  )

  const doConsent = useSafeCallback(
    async (sub: string, scope?: string) => {
      // If "remember me" was unchecked, we need to use the ephemeral token to
      // authenticate the request.
      const bearer = sessions.find((s) => s.account.sub === sub)?.ephemeralToken
      const { url } = await api.fetch(
        'POST',
        '/consent',
        { sub, scope },
        { bearer },
      )
      performRedirect(url)
    },
    [api, sessions, performRedirect],
  )

  const doReject = useSafeCallback(async () => {
    const { url } = await api.fetch('POST', '/reject', {})
    performRedirect(url)
  }, [api, performRedirect])

  return {
    sessions,
    selectSub,

    doSignIn,
    doInitiatePasswordReset,
    doConfirmResetPassword,
    doValidateNewHandle,
    doSignUp,
    doConsent,
    doReject,
  }
}
