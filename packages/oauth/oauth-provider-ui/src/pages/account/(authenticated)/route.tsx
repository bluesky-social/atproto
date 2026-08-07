import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import {
  Navigate,
  Outlet,
  createRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import {
  CircleQuestionMarkIcon,
  GlobeIcon,
  HouseIcon,
  type LucideIcon,
  MonitorSmartphoneIcon,
  UserIcon,
} from 'lucide-react'
import {
  type FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { AuthenticateWelcomeView } from '#/components/authenticate-welcome-view.tsx'
import {
  AccountShell,
  type AccountShellLink,
} from '#/components/layouts/account-shell.tsx'
import { SignInView } from '#/components/sign-in-view.tsx'
import { SignUpView } from '#/components/sign-up-view.tsx'
import { ProvideAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { type Session, useSessionContext } from '#/contexts/session.tsx'
import type { Explicit } from '#/lib/util.ts'
import { RootRoute } from '../../route.tsx'
import { Page as AccountAboutPage } from './about/page.tsx'
import { Page as AccountOAuthPage } from './apps/page.tsx'
import { Page as AccountDevicesPage } from './devices/page.tsx'
import { Page as AccountManagePage } from './manage/page.tsx'
import { Page as AccountIndexPage } from './page.tsx'

// @NOTE `to` targets are cast to `any`: this file *defines* the routes that
// make up the registered router, so referencing the router's own path types
// here is circular. The existing shell already casts link `to` values the same
// way.

type SubPage = {
  title: string | MessageDescriptor
  icon?: LucideIcon
  hidden?: boolean
  position?: number
  description?: string | MessageDescriptor
  component: FunctionComponent
}

type SubPages<T extends `/${string}` = `/${string}`> = {
  [K in T]: SubPage
}

const DEFAULT_PAGES = {
  '/': {
    icon: HouseIcon,
    position: 0,
    title: msg`Home`,
    component: () => <AccountIndexPage />,
  },
  '/manage': {
    icon: UserIcon,
    position: 10,
    title: msg`Account`,
    description: msg`Manage your account`,
    component: () => <AccountManagePage />,
  },
  '/devices': {
    icon: MonitorSmartphoneIcon,
    position: 20,
    title: msg`Devices`,
    description: msg`Manage your active sessions`,
    component: () => <AccountDevicesPage />,
  },
  '/apps': {
    icon: GlobeIcon,
    position: 30,
    title: msg`Apps`,
    description: msg`Manage applications that have access to your account`,
    component: () => <AccountOAuthPage />,
  },
  '/about': {
    icon: CircleQuestionMarkIcon,
    position: 50,
    title: msg`About`,
    component: () => <AccountAboutPage />,
    description: msg`What is an Atmosphere Account?`,
  },
} satisfies SubPages

/**
 * A stable, URL-safe key for the account segment (`/account/u/<id>`). Handles
 * are readable and stable enough for a device-local portal; DID is the
 * fallback (and true stable identity) when no handle is available.
 */
function accountKey(account: Pick<Account, 'did' | 'handle'>): string {
  return account.handle || account.did
}

function findSession(
  sessions: readonly Session[],
  id: string | undefined,
): Session | undefined {
  if (!id) return undefined
  return sessions.find((s) => s.account.handle === id || s.account.did === id)
}

/**
 * Popup / webview embedding controls. Mirrors the (very experimental) behavior
 * that used to live in `AuthGate`: an app can open this page constrained to a
 * single account and be notified when the user is "done".
 *
 * @NOTE This EXPERIMENTAL API **WILL** change. It MUST NOT be relied upon.
 */
const initialUrl = new URL(window.location.href)

function usePopupControls(signOutTo: any) {
  const navigate = useNavigate()

  const isPopup = initialUrl.searchParams.get('display') === 'popup'
  const forcedIdentifier =
    initialUrl.searchParams.get('login_hint') || undefined
  const nonce = initialUrl.searchParams.get('nonce') || undefined
  const callbackUrl = initialUrl.searchParams.get('redirect_uri') || undefined

  const done = useMemo<undefined | (() => void)>(() => {
    if (callbackUrl && nonce) {
      return () => {
        window.location.href = new URL(callbackUrl).toString()
      }
    } else if (isPopup) {
      return () => {
        // Posted on several targets because the opener may be on a different
        // origin (mobile webview, browser popup, ...).
        window.opener?.postMessage({ nonce, event: 'done' }, '*')
        window.postMessage({ nonce, event: 'done' }, '*')
        window.close()
      }
    }
  }, [isPopup, callbackUrl, nonce])

  const leave = useCallback(() => {
    if (done) done()
    else navigate({ to: signOutTo })
  }, [done, navigate, signOutTo])

  return {
    isPopup,
    forcedIdentifier,
    disableRemember: isPopup,
    done,
    leave,
  }
}

export function buildRoutes<T extends `/${string}`>(
  basePath: T,
  customPages?: SubPages,
) {
  const subPages = { ...DEFAULT_PAGES, ...customPages }

  const signInPath = `${basePath}/sign-in` as any
  const signUpPath = `${basePath}/sign-up` as any
  const resetPasswordPath = `${basePath}/reset-password` as any
  // `$accountId` is interpolated from params at navigation time.
  const accountToPath = `${basePath}/u/$accountId` as any

  // -- Bare `/account`: resolve the default selection -----------------------
  // A single session is entered directly; several means the user must pick
  // (mirrors the old `InitialSelectedSession.Only` stance).
  const indexRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: basePath,
    component: function AccountIndexRedirect() {
      const { sessions } = useSessionContext()
      if (sessions.length === 1) {
        return (
          <Navigate
            to={accountToPath}
            params={{ accountId: accountKey(sessions[0].account) } as never}
            replace
          />
        )
      }
      return <Navigate to={signInPath} replace />
    },
  })

  // -- `/account/sign-in`: welcome, account picker, and credentials form -----
  const signInRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: signInPath as string,
    component: function AccountSignIn() {
      const { sessions, api } = useSessionContext()
      const navigate = useNavigate()
      const { availableUserDomains } = useCustomizationData()
      const { isPopup, forcedIdentifier, disableRemember, done, leave } =
        usePopupControls(basePath as any)

      const canSignUp =
        Boolean(availableUserDomains?.length) && !forcedIdentifier

      // Account pending password confirmation (a `loginRequired` session picked
      // from the list, or an account added via the form).
      const [pending, setPending] = useState<Session | null>(null)
      // The create-vs-sign-in choice, only relevant with zero sessions.
      const [showWelcome, setShowWelcome] = useState(
        sessions.length === 0 && canSignUp,
      )

      const goToAccount = useCallback(
        (account: Pick<Account, 'did' | 'handle'>) => {
          navigate({
            to: accountToPath,
            params: { accountId: accountKey(account) } as never,
            replace: true,
          })
        },
        [navigate],
      )

      if (showWelcome && !pending) {
        return (
          <AuthenticateWelcomeView
            onSignIn={() => setShowWelcome(false)}
            onSignUp={
              canSignUp ? () => navigate({ to: signUpPath }) : undefined
            }
            onCancel={done}
          />
        )
      }

      return (
        <SignInView
          disableRemember={disableRemember}
          forcedIdentifier={forcedIdentifier}
          sessions={sessions}
          session={pending}
          setSession={(next) => {
            if (!next) {
              setPending(null)
              return
            }
            const full = findSession(sessions, next.account.did) ?? null
            // A remembered session goes straight in; otherwise confirm password.
            if (full && !full.loginRequired) goToAccount(full.account)
            else setPending(full)
          }}
          onSignIn={async (data) => {
            const output = await api.signIn(data)
            goToAccount(output.account)
          }}
          onSignUp={canSignUp ? () => navigate({ to: signUpPath }) : undefined}
          onForgotPassword={(email) =>
            navigate({
              to: resetPasswordPath,
              search: (email ? { email } : {}) as never,
            })
          }
          onBack={
            pending
              ? undefined
              : isPopup || done
                ? leave
                : canSignUp
                  ? () => setShowWelcome(true)
                  : undefined
          }
        />
      )
    },
  })

  // -- `/account/sign-up` ----------------------------------------------------
  const signUpRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: signUpPath as string,
    component: function AccountSignUp() {
      const { api } = useSessionContext()
      const navigate = useNavigate()
      return (
        <SignUpView
          onValidateNewHandle={async (data) => {
            await api.validateHandleAvailability(data)
          }}
          onBack={() => navigate({ to: signInPath })}
          onDone={async (data) => {
            const output = await api.signUp(data)
            // Sign-up establishes a session; go straight into its manager.
            navigate({
              to: accountToPath,
              params: { accountId: accountKey(output.account) } as never,
              replace: true,
            })
          }}
        />
      )
    },
  })

  // -- `/account/u/$accountId`: the account-scoped manager -------------------
  const accountRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: `${basePath}/u/$accountId` as string,
    component: function AccountScoped() {
      const params = useParams({ strict: false }) as { accountId?: string }
      const accountId = params.accountId
      const {
        sessions,
        session: ctxSession,
        setSession,
        api,
      } = useSessionContext()
      const { forcedIdentifier } = usePopupControls(basePath as any)

      const selected = findSession(sessions, accountId)

      // Mirror the URL selection into the session context so that `api` carries
      // the right account's token (the context is the single owner of `api`).
      useEffect(() => {
        if (selected && ctxSession?.account.did !== selected.account.did) {
          setSession(selected)
        }
      }, [selected, ctxSession, setSession])

      const scopedBase = `${basePath}/u/${accountId}`

      const links = useMemo<readonly AccountShellLink[]>(() => {
        return (Object.entries(subPages) as [string, SubPage][])
          .sort(([ap, a], [bp, b]) => {
            if (a.position != null && b.position != null) {
              const diff = a.position - b.position
              if (diff !== 0) return diff
            }
            return ap.localeCompare(bp)
          })
          .map(([subPath, page]): Explicit<AccountShellLink> => ({
            to: (subPath === '/'
              ? scopedBase
              : `${scopedBase}${subPath}`) as any,
            title: page.title,
            description: page.description,
            hidden: page.hidden,
            icon: page.icon,
          }))
      }, [scopedBase])

      // Guard: no such (usable) session, or the popup constrains to another
      // account -> back to the picker.
      const forcedMismatch =
        forcedIdentifier != null &&
        selected != null &&
        selected.account.did !== forcedIdentifier &&
        selected.account.handle !== forcedIdentifier
      if (!selected || selected.loginRequired || forcedMismatch) {
        return <Navigate to={signInPath} replace />
      }

      // Wait one tick for the context mirror so children fetch with the right
      // token instead of the previously-selected account's.
      if (ctxSession?.account.did !== selected.account.did) {
        return null
      }

      return (
        <ProvideAuthenticatedSession
          value={{
            session: ctxSession,
            sessions,
            canSwitchAccounts: forcedIdentifier == null,
            api,
          }}
        >
          <AccountShell
            title={msg`My Atmosphere Account`}
            basePath={scopedBase as any}
            links={links}
          >
            <Outlet />
          </AccountShell>
        </ProvideAuthenticatedSession>
      )
    },
  })

  const childRoutes = (
    Object.entries(subPages) as [keyof typeof subPages, SubPage][]
  ).map(([path, { component }]) => {
    return createRoute({
      getParentRoute: () => accountRoute,
      path: path as string,
      component,
    })
  })

  return [
    indexRoute,
    signInRoute,
    signUpRoute,
    accountRoute.addChildren(childRoutes),
  ] as const
}
