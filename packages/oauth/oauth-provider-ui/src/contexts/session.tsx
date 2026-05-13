import { useLingui } from '@lingui/react/macro'
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import type {
  Account,
  ConfirmResetPasswordInput,
  InitiatePasswordResetInput,
  Session,
  SignInInput,
  SignOutInput,
  SignUpInput,
  VerifyHandleAvailabilityInput,
} from '@atproto/oauth-provider-api'
import { Api, UnauthorizedError, UnknownRequestUriError } from '#/lib/api.ts'
import { upsert } from '#/lib/util.ts'
import { useCurrentLocale } from '#/locales/locale-provider'
import { useNotificationsContext } from './notifications'

export type { Session }

export type SessionWithToken = Session & {
  ephemeralToken?: string
}

export type SessionContextType = {
  sessions: readonly Session[]
  session: Session | null
  setSession: (session: Pick<Session, 'account'> | null) => void

  api: Api

  /** @deprecated use api.fetch instead */
  doSignIn: (data: Omit<SignInInput, 'locale'>) => Promise<void>
  /** @deprecated use api.fetch instead */
  doSignOut: (data: SignOutInput) => Promise<void>
  /** @deprecated use api.fetch instead */
  doInitiatePasswordReset: (
    data: Omit<InitiatePasswordResetInput, 'locale'>,
  ) => Promise<void>
  /** @deprecated use api.fetch instead */
  doConfirmResetPassword: (data: ConfirmResetPasswordInput) => Promise<void>
  /** @deprecated use api.validateHandleAvailability() instead */
  doValidateNewHandle: (data: VerifyHandleAvailabilityInput) => Promise<void>
  /** @deprecated use api.signUp() instead */
  doSignUp: (data: Omit<SignUpInput, 'locale'>) => Promise<void>
  /** @deprecated use api.consent() instead */
  doConsent: (
    sub: string,
    scope?: string | undefined,
  ) => Promise<{ url: string }>
  /** @deprecated use api.reject() instead */
  doReject: () => Promise<{ url: string }>
}

const SessionContext = createContext<null | SessionContextType>(null)
SessionContext.displayName = 'SessionContext'

export enum InitialSelectedSession {
  First,
  Only,
}

export type SessionProviderProps = {
  children: ReactNode
  initialSessions: readonly Session[]
  initialSelected?: string | InitialSelectedSession
}

export function SessionProvider({
  children,
  initialSessions,
  initialSelected,
}: SessionProviderProps) {
  const { t } = useLingui()
  const locale = useCurrentLocale()
  const { showBoundary } = useErrorBoundary<UnknownRequestUriError>()
  const { notify } = useNotificationsContext()
  const [current, setCurrent] = useState(() => {
    if (initialSelected === InitialSelectedSession.First) {
      return initialSessions[0]?.account.sub ?? null
    }
    if (initialSelected === InitialSelectedSession.Only) {
      return initialSessions.length === 1
        ? initialSessions[0].account.sub
        : null
    }
    if (initialSessions.some((s) => s.account.sub === initialSelected)) {
      return initialSelected
    }
    return null
  })
  const [sessions, setSessions] =
    useState<readonly SessionWithToken[]>(initialSessions)

  const session = useMemo(() => {
    return current
      ? sessions.find((s) => s.account.sub === current) ?? null
      : null
  }, [sessions, current])

  const setSession = useCallback(
    (session: { account: Account } | null) => {
      setCurrent(
        session && sessions.some((s) => s.account.sub === session.account.sub)
          ? session.account.sub
          : null,
      )
    },
    [sessions, setCurrent],
  )

  const upsertSession = useCallback(
    ({
      account,
      ephemeralToken,
      // The server will tell us if the user needs to consent to the
      // authorization. Defaults to true in case of sign-ups
      consentRequired = true,
      // When a new session is inserted, it is assumed that the user just
      // created the session, and therefore, login is not required.
      loginRequired = false,
    }: { account: Account } & Partial<SessionWithToken>) => {
      setSessions((sessions) => {
        return upsert(
          sessions,
          {
            account,
            ephemeralToken,
            loginRequired,
            consentRequired,
          },
          (s) => s.account.sub === account.sub,
        )
      })
      setCurrent(account.sub)
    },
    [setCurrent, setSessions],
  )

  const removeSession = useCallback(
    (sub: string | string[]) => {
      if (Array.isArray(sub)) {
        setSessions((sessions) =>
          sessions.filter((s) => !sub.includes(s.account.sub)),
        )
        setCurrent((current) =>
          current != null && sub.includes(current) ? null : current,
        )
      } else {
        setSessions((sessions) => sessions.filter((s) => s.account.sub !== sub))
        setCurrent((current) => (current === sub ? null : current))
      }
    },
    [setSessions, setCurrent],
  )

  const api = useMemo(() => {
    return new Api({
      onFetchError(err) {
        if (err instanceof UnknownRequestUriError) showBoundary(err)
        if (err instanceof UnauthorizedError) {
          if (session) removeSession(session.account.sub)

          notify({
            variant: 'error',
            title: t`Unauthorized`,
            description: t`Your session has expired. Please sign in again.`,
          })
        }
        throw err
      },
      onFetchSuccess: {
        '/sign-in': ({ json }) => upsertSession(json),
        '/sign-up': ({ json }) => upsertSession(json),
        '/sign-out': ({ input }) => removeSession(input.sub),
      },
      headers: session?.ephemeralToken
        ? () => ({ Authorization: `Bearer ${session.ephemeralToken}` })
        : undefined,
    })
  }, [session, showBoundary, removeSession, upsertSession, notify, t])

  const value = useMemo<SessionContextType>(
    () => ({
      api,

      sessions,
      session,
      setSession,

      // Deprecated helpers: Don't add new ones, use api.fetch(). Add
      // specific methods to the API class if needed.
      doSignIn: async (data: Omit<SignInInput, 'locale'>) => {
        await api.signIn({ ...data, locale })
      },
      doSignOut: async ({ sub }: SignOutInput) => {
        await api.signOut(sub)
      },
      doInitiatePasswordReset: async (
        data: Omit<InitiatePasswordResetInput, 'locale'>,
      ) => {
        await api.initiatePasswordReset({ ...data, locale })
      },
      doConfirmResetPassword: async (data: ConfirmResetPasswordInput) => {
        await api.confirmResetPassword(data)
      },
      doValidateNewHandle: async (data: VerifyHandleAvailabilityInput) => {
        await api.validateHandleAvailability(data)
      },
      doSignUp: async (data: Omit<SignUpInput, 'locale'>) => {
        await api.signUp({ ...data, locale })
      },
      doConsent: async (sub: string, scope?: string) => {
        return api.consent(sub, scope)
      },
      doReject: async () => {
        return api.fetch('POST', '/reject', {})
      },
    }),
    [api, locale, sessions, session, setSession],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSessionContext() {
  const value = useContext(SessionContext)
  if (value) return value
  throw new Error('useSessionContext must be used within a SessionProvider')
}

export function useApi() {
  const { api } = useSessionContext()
  return api
}
