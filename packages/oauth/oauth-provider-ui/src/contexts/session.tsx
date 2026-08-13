import { msg } from '@lingui/core/macro'
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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

/**
 * The parts of the session state that TanStack Router's `beforeLoad` guards
 * read, on an object whose identity never changes.
 *
 * @NOTE The getters are the point. A guard runs outside React — during a
 * navigation, which is typically dispatched from the very event handler that
 * just signed the user in — so a value captured at render time would be one
 * render behind and the guard would reject the account it was sent to.
 */
export type SessionStore = {
  readonly sessions: readonly Session[]
  readonly session: Session | null
  readonly canSignUp: boolean
  readonly canSwitchAccounts: boolean
}

export type SessionContextType = {
  sessions: readonly Session[]
  session: Session | null
  setSession: (session: Pick<Session, 'account'> | null) => void

  api: Api
  store: SessionStore
  canSignUp: boolean
  canSwitchAccounts: boolean
  disableRemember: boolean
  forcedIdentifier: undefined | string
  leave: undefined | (() => void | Promise<void>)
}

const SessionContext = createContext<null | SessionContextType>(null)
SessionContext.displayName = 'SessionContext'

type SessionState = {
  sessions: readonly SessionWithToken[]
  current: DidString | null
}

function findSession(
  sessions: readonly SessionWithToken[],
  current: DidString | null,
): SessionWithToken | null {
  if (!current) return null
  return sessions.find((s) => s.account.did === current) ?? null
}

export const enum InitialSelectedSession {
  First,
  Only,
}

export type SessionProviderProps = {
  children: ReactNode
  initialSessions: readonly Session[]
  initialSelected?: DidString | InitialSelectedSession
  disableRemember?: boolean
  forcedIdentifier?: string
  leave?: () => void | Promise<void>
}

export function SessionProvider({
  children,
  initialSessions,
  initialSelected,
  disableRemember = false,
  forcedIdentifier = undefined,
  leave = undefined,
}: SessionProviderProps) {
  const locale = useCurrentLocale()
  const { availableUserDomains } = useCustomizationData()
  const { showBoundary } = useErrorBoundary()
  const { notifyError } = useNotificationsContext()
  const [state, setState] = useState<SessionState>(() => {
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

    return {
      sessions: initialSessions,
      current: initialSession ? initialSession.account.did : null,
    }
  })

  // @NOTE The ref is the state the router's guards read; `state` is the same
  // value, for React. Only ever written from an event handler (through
  // `update`), never during render.
  const stateRef = useRef(state)

  const update = useCallback(
    (fn: (state: SessionState) => SessionState) => {
      const next = fn(stateRef.current)
      if (next === stateRef.current) return
      stateRef.current = next
      setState(next)
    },
    [setState],
  )

  const { sessions } = state
  const session = useMemo(
    () => findSession(state.sessions, state.current),
    [state],
  )

  const setSession = useCallback(
    (session: { account: Account } | null) => {
      update((state) => ({
        ...state,
        current:
          session &&
          state.sessions.some((s) => s.account.did === session.account.did)
            ? session.account.did
            : null,
      }))
    },
    [update],
  )

  const upsertSession = useCallback(
    ({
      account,
      ephemeralToken,
      // When a new session is inserted, it is assumed that the user just
      // created the session, and therefore, login is not required.
      loginRequired = false,
    }: { account: Account } & Partial<SessionWithToken>) => {
      update((state) => ({
        sessions: upsert(
          state.sessions,
          { account, ephemeralToken, loginRequired },
          (s) => s.account.did === account.did,
        ),
        current: account.did,
      }))
    },
    [update],
  )

  const upsertAccount = useCallback(
    (account: Account) => {
      update((state) => ({
        ...state,
        sessions: state.sessions.map((s) =>
          s.account.did === account.did ? { ...s, account } : s,
        ),
      }))
    },
    [update],
  )

  const removeSession = useCallback(
    (did: string | string[]) => {
      const dids = Array.isArray(did) ? did : [did]
      update((state) => ({
        sessions: state.sessions.filter((s) => !dids.includes(s.account.did)),
        current:
          state.current != null && dids.includes(state.current)
            ? null
            : state.current,
      }))
    },
    [update],
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
  const canSignUp = hasDomains && !forcedIdentifier
  const canSwitchAccounts = !forcedIdentifier

  const store = useMemo(
    (): SessionStore => ({
      get sessions() {
        return stateRef.current.sessions
      },
      get session() {
        const { sessions, current } = stateRef.current
        return findSession(sessions, current)
      },
      canSignUp,
      canSwitchAccounts,
    }),
    [canSignUp, canSwitchAccounts],
  )

  const value = useMemo(
    (): SessionContextType => ({
      api,
      store,
      sessions,
      session,
      setSession,
      leave,
      disableRemember,
      forcedIdentifier,
      canSignUp,
      canSwitchAccounts,
    }),
    [
      api,
      store,
      sessions,
      session,
      setSession,
      leave,
      disableRemember,
      forcedIdentifier,
      canSignUp,
      canSwitchAccounts,
    ],
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
