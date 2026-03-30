import './style.css'

import { msg } from '@lingui/core/macro'
import {
  DevicesIcon,
  GlobeIcon,
  HouseSimpleIcon,
  KeyIcon,
  ShieldIcon,
} from '@phosphor-icons/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode, useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorView } from '#/components/error-view.tsx'
import { Palette } from '#/components/utils/palette.tsx'
import { AuthenticationProvider } from '#/contexts/authentication.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import { NotificationsProvider } from '#/contexts/notifications.tsx'
import {
  InitialSelectedSession,
  SessionProvider,
  useSessionContext,
} from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'
import { Page as AccountOAuthPage } from '#/routes/account/apps/page'
import { Page as AccountDevicesPage } from '#/routes/account/devices/page.tsx'
import { createLayoutRoute } from '#/routes/account/layout.tsx'
import { Page as AccountIndexPage } from '#/routes/account/page.tsx'
import { Page as AccountPasswordPage } from '#/routes/account/password/page.tsx'
import { RootRoute } from '#/routes/account.tsx'

const {
  __customizationData: customizationData,
  __deviceSessions: deviceSessions,
} = window as typeof window & HydrationData['account-page']

const initialUrl = new URL(window.location.href)

const qc = new QueryClient()

const childRoutes = createLayoutRoute({
  getParentRoute: () => RootRoute,

  path: '/account',
  title: msg`My Account`,
  pages: {
    '/': {
      icon: HouseSimpleIcon,
      position: 0,
      title: msg`Account`,
      component: AccountIndexPage,
    },
    '/apps': {
      icon: GlobeIcon,
      position: 10,
      title: msg`Applications`,
      description: msg`Manage applications that have access to your account`,
      component: AccountOAuthPage,
    },
    '/devices': {
      icon: DevicesIcon,
      position: 20,
      title: msg`Devices`,
      description: msg`Manage your active sessions`,
      component: AccountDevicesPage,
    },
    '/password': {
      icon: KeyIcon,
      position: 30,
      title: msg`Password`,
      description: msg`Change your account password`,
      component: AccountPasswordPage,
    },
    '/branding': {
      icon: ShieldIcon,
      hidden: true,
      position: 40,
      title: msg`Branding`,
      component: Palette,
    },
  },
})

const router = createRouter({
  routeTree: RootRoute.addChildren(childRoutes),
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider userLocales={window.navigator.languages}>
        <NotificationsProvider>
          <ErrorBoundary fallbackRender={ErrorView}>
            <SessionProvider
              initialSessions={deviceSessions}
              initialSelected={InitialSelectedSession.Only}
            >
              <QueryClientProvider client={qc}>
                <App />
              </QueryClientProvider>
            </SessionProvider>
          </ErrorBoundary>
        </NotificationsProvider>
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)

function App() {
  // This page supports a mode where it is loaded, by an app, in a webview or
  // popup, to let the user manage their atmosphere account without leaving the
  // app. In that case, we constrain the user to only use the account for which
  // they opened the page, and we send a signal to the opener when they perform
  // actions that signal the user is done with the page (like logging out, or
  // explicitly "canceling" the sign-in).

  const { session } = useSessionContext()
  const hasSession = useRef(session != null)

  const isPopup = initialUrl.searchParams.get('display') === 'popup'
  const sub = initialUrl.searchParams.get('sub') || undefined

  const closeWindow = useMemo<undefined | (() => void)>(() => {
    if (isPopup) {
      return () => {
        // Due to the various ways this page can be embedded (e.g. webview in a
        // mobile app, a popup in a browser), and the fact that the opener might
        // be on a different origin, we post the message on various targets to
        // ensure it is received.
        window.opener?.postMessage({ type: 'done' }, '*')
        window.postMessage({ type: 'done' }, '*')
        window.close()
      }
    }
  }, [isPopup])

  useEffect(() => {
    if (session && !hasSession.current) {
      hasSession.current = true
    } else if (!session && hasSession.current) {
      hasSession.current = false
      closeWindow?.()
    }
  }, [session, closeWindow])

  return (
    <AuthenticationProvider
      forcedIdentifier={sub}
      disableRemember={isPopup}
      onCancel={closeWindow}
    >
      <RouterProvider router={router} />
    </AuthenticationProvider>
  )
}
