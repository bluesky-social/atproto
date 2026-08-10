import { msg } from '@lingui/core/macro'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useErrorBoundary } from 'react-error-boundary'
import type { Account, DidString, Session } from '@atproto/oauth-provider-api'
import { Api, UnauthorizedError, UnknownRequestUriError } from '#/lib/api.ts'
import { upsert } from '#/lib/util.ts'
import { useCurrentLocale } from '#/locales/locale-provider.jsx'
import { useCustomizationData } from './customization.js'
import { useNotificationsContext } from './notifications.js'

export type { Session }

export type SessionWithToken = Session & {
  ephemeralToken?: string
}

export type SessionContextType = {
  sessions: readonly Session[]
  session: Session | null
  setSession: (session: Pick<Session, 'account'> | null) => void

  api: Api
  canSignUp: boolean
  canSwitchAccounts: boolean
  forcedIdentifier: undefined | string
  leave: undefined | (() => void | Promise<void>)
}

const SessionContext = createContext<null | SessionContextType>(null)
SessionContext.displayName = 'SessionContext'

export const enum InitialSelectedSession {
  First,
  Only,
}

export type SessionProviderProps = {
  children: ReactNode
  initialSessions: readonly Session[]
  initialSelected?: DidString | InitialSelectedSession
  forcedIdentifier?: string
  leave?: () => void | Promise<void>
}

export function SessionProvider({
  children,
  initialSessions,
  initialSelected,
  forcedIdentifier = undefined,
  leave = undefined,
}: SessionProviderProps) {
  const locale = useCurrentLocale()
  const { availableUserDomains } = useCustomizationData()
  const { showBoundary } = useErrorBoundary<UnknownRequestUriError>()
  const { notifyError } = useNotificationsContext()
  const [current, setCurrent] = useState<DidString | null>(() => {
    const initialSession: Session | undefined = forcedIdentifier
      ? initialSessions.find(
          (s) =>
            s.account.handle === forcedIdentifier ||
            s.account.did === forcedIdentifier,
        )
      : initialSelected === InitialSelectedSession.First
        ? initialSessions[0]
        : initialSelected === InitialSelectedSession.Only
          ? initialSessions.length === 1
            ? initialSessions[0]
            : undefined
          : initialSelected != null
            ? initialSessions.find((s) => s.account.did === initialSelected)
            : undefined

    return initialSession ? initialSession.account.did : null
  })
  const [sessions, setSessions] =
    useState<readonly SessionWithToken[]>(initialSessions)

  const session = useMemo(() => {
    return current
      ? (sessions.find(
          (s) => s.account.did === current || s.account.handle === current,
        ) ?? null)
      : null
  }, [sessions, current])

  const setSession = useCallback(
    (session: { account: Account } | null) => {
      setCurrent(
        session && sessions.some((s) => s.account.did === session.account.did)
          ? session.account.did
          : null,
      )
    },
    [sessions, setCurrent],
  )

  const upsertSession = useCallback(
    ({
      account,
      ephemeralToken,
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
          },
          (s) => s.account.did === account.did,
        )
      })
      setCurrent(account.did)
    },
    [setCurrent, setSessions],
  )

  const upsertAccount = useCallback(
    (account: Account) => {
      setSessions((sessions) =>
        sessions.map((s) =>
          s.account.did === account.did ? { ...s, account } : s,
        ),
      )
    },
    [setSessions],
  )

  const removeSession = useCallback(
    (did: string | string[]) => {
      if (Array.isArray(did)) {
        setSessions((sessions) =>
          sessions.filter((s) => !did.includes(s.account.did)),
        )
        setCurrent((current) =>
          current != null && did.includes(current) ? null : current,
        )
      } else {
        setSessions((sessions) => sessions.filter((s) => s.account.did !== did))
        setCurrent((current) => (current === did ? null : current))
      }
    },
    [setSessions, setCurrent],
  )

  const api = useMemo(() => {
    return new Api({
      locale,
      onFetchError(err) {
        if (err instanceof UnknownRequestUriError) showBoundary(err)
        if (err instanceof UnauthorizedError) {
          if (session) removeSession(session.account.did)

          notifyError(err, {
            title: msg`Unauthorized`,
            description: msg`Your session has expired. Please sign in again.`,
          })
        }
        throw err
      },
      onFetchSuccess: {
        // Session updates
        '/sign-in': ({ output }) => upsertSession(output),
        '/sign-up': ({ output }) => upsertSession(output),
        '/sign-out': ({ input }) => removeSession(input.did),
        '/delete-account-confirm': ({ input }) => removeSession(input.did),

        // Account updates
        '/update-handle': ({ output }) => upsertAccount(output.account),
        '/update-email-confirm': ({ output }) => upsertAccount(output.account),
        '/verify-email-confirm': ({ output }) => upsertAccount(output.account),
        '/deactivate-account': ({ output }) => upsertAccount(output.account),
        '/reactivate-account': ({ output }) => upsertAccount(output.account),
      },
      headers: session?.ephemeralToken
        ? () => ({ Authorization: `Bearer ${session.ephemeralToken}` })
        : undefined,
    })
  }, [
    locale,
    session,
    showBoundary,
    upsertAccount,
    upsertSession,
    removeSession,
    notifyError,
  ])

  const hasDomains = !!availableUserDomains?.length
  const value = useMemo(
    (): SessionContextType => ({
      api,
      sessions,
      session,
      setSession,
      leave,
      forcedIdentifier,
      canSignUp: hasDomains && !forcedIdentifier,
      canSwitchAccounts: !forcedIdentifier,
    }),
    [api, sessions, session, setSession, leave, forcedIdentifier, hasDomains],
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
