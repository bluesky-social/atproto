import './style.css'

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { ConsentView } from '#/components/consent-view.tsx'
import { errorViewRender } from '#/components/error-view.tsx'
import { LayoutTitle } from '#/components/layouts/layout-title'
import { AuthenticationProvider } from '#/contexts/authentication.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import { NotificationsProvider } from '#/contexts/notifications.tsx'
import { SessionProvider, useSessionContext } from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'
import { useStableCallback } from './hooks/use-stable-callback'

const {
  __authorizeData: authorizeData,
  __customizationData: customizationData,
  __sessions: initialSessions,
} = window as typeof window & HydrationData['authorization-page']

// When the user is logging in, make sure the page URL contains the
// "request_uri" in case the user refreshes the page.
// @TODO Actually do this on the backend through a redirect.
const url = new URL(window.location.href)
if (
  url.pathname === '/oauth/authorize' &&
  !url.searchParams.has('request_uri')
) {
  url.search = ''
  url.searchParams.set('client_id', authorizeData.clientId)
  url.searchParams.set('request_uri', authorizeData.requestUri)
  window.history.replaceState(history.state, '', url.pathname + url.search)
}

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider userLocales={authorizeData.uiLocales?.split(' ')}>
        <NotificationsProvider>
          <ErrorBoundary fallbackRender={errorViewRender}>
            <SessionProvider
              initialSessions={initialSessions}
              initialSelected={authorizeData.selectedSub}
            >
              <App />
            </SessionProvider>
          </ErrorBoundary>
        </NotificationsProvider>
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)

// @NOTE We do not want to use a router here because we do not want any change
// in the view to be reflected as a browser navigation.
function App() {
  const loginHint = authorizeData.loginHint || undefined

  const { session, setSession, api } = useSessionContext()
  const [isDone, setIsDone] = useState(
    session != null && session.consentRequired === false,
  )

  const performRedirect = useStableCallback((url: string) => {
    // @TODO At this point, the request cannot be accepted/rejected anymore.
    // We should probably change the app's state to something that indicates
    // that in order to improve UX in case the user comes back to the app.
    // This is currently ensured by the backend (through back-forward cache
    // busting) but handling it here would provide a better UX since the
    // backend will remove (and prevent access) to accepted/rejected requests
    // data, while the back-forward cache remembers them.

    window.location.href = url
    setTimeout(() => setIsDone(true))
  })

  const doConsentAndRedirect = useCallback(
    async ({ scope }: { scope?: string }) => {
      const { url } = await api.consent(session!.account.sub, scope)
      performRedirect(url)
    },
    [api, session, performRedirect],
  )

  const doRejectAndRedirect = useCallback(async () => {
    const { url } = await api.reject()
    performRedirect(url)
  }, [api, performRedirect])

  return (
    <AuthenticationProvider
      onCancel={doRejectAndRedirect}
      forcedIdentifier={loginHint}
      promptMode={authorizeData.promptMode}
    >
      {session && !isDone ? (
        <ConsentView
          clientId={authorizeData.clientId}
          clientMetadata={authorizeData.clientMetadata}
          clientTrusted={authorizeData.clientTrusted}
          clientFirstParty={authorizeData.clientFirstParty}
          permissionSets={authorizeData.permissionSets}
          account={session.account}
          scope={authorizeData.scope}
          onConsent={doConsentAndRedirect}
          onReject={doRejectAndRedirect}
          onBack={loginHint ? undefined : () => setSession(null)}
        />
      ) : (
        <LayoutTitle title={msg`Login complete`}>
          <Trans>You are being redirected...</Trans>
        </LayoutTitle>
      )}
    </AuthenticationProvider>
  )
}
