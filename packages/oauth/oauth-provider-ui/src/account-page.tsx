import './style.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorView } from '#/components/error-view.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import { NotificationsProvider } from '#/contexts/notifications.tsx'
import {
  InitialSelectedSession,
  SessionProvider,
  useSessionContext,
} from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'
import { queryClient, router } from '#/router.tsx'

const {
  __customizationData: customizationData,
  __deviceSessions: deviceSessions,
} = window as typeof window & HydrationData['account-page']

const container = document.getElementById('root')!

/**
 * Popup / webview embedding controls. Mirrors the (very experimental) behavior:
 * an app can open this page constrained to a single account and be notified
 * when the user is "done".
 *
 * @NOTE This EXPERIMENTAL API **WILL** change. It MUST NOT be relied upon.
 */
const { searchParams } = new URL(window.location.href)

// This is what enables the "single account" mode. If present, the user is
// constrained to the account with this handle or DID. If absent, the user can
// switch between any of the sessions on the device. If missing, the display,
// nonce and redirect_uri params are ignored.
const forcedIdentifier = searchParams.get('login_hint') || undefined

const nonce = searchParams.get('nonce') || undefined
const callbackUrl = searchParams.get('redirect_uri') || undefined
const isPopup = searchParams.get('display') === 'popup'

const done = forcedIdentifier
  ? callbackUrl && nonce
    ? () => {
        const url = new URL(callbackUrl)
        url.searchParams.set('nonce', nonce)
        window.location.href = url.toString()
      }
    : isPopup
      ? () => {
          // Posted on several targets because the opener may be on a different
          // origin (mobile webview, browser popup, ...).
          window.opener?.postMessage({ nonce, event: 'done' }, '*')
          window.postMessage({ nonce, event: 'done' }, '*')
          window.close()
        }
      : undefined
  : undefined

/**
 * Bridges the session state into the router: the guards run outside React, so
 * they read it from the router's context rather than through a hook.
 */
function AccountRouter() {
  const { store, api } = useSessionContext()

  // @NOTE `RouterProvider` applies the new context on render, but it does not
  // re-run the guards — invalidating does. This is what makes signing out (or
  // an expired session being dropped) move the user on its own, with no
  // navigation wired into the action that caused it.
  useEffect(() => {
    void router.invalidate()
  }, [store.sessions, store.session])

  return <RouterProvider router={router} context={{ auth: store, api }} />
}

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider>
        <NotificationsProvider>
          <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) => (
              <ErrorView error={error} retry={resetErrorBoundary} />
            )}
          >
            <SessionProvider
              initialSessions={deviceSessions}
              initialSelected={InitialSelectedSession.Only}
              disableRemember={isPopup}
              forcedIdentifier={forcedIdentifier}
              leave={done}
            >
              <QueryClientProvider client={queryClient}>
                <AccountRouter />
              </QueryClientProvider>
            </SessionProvider>
          </ErrorBoundary>
        </NotificationsProvider>
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)
