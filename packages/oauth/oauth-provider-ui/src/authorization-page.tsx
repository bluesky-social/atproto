import './style.css'

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { ConsentView } from '#/components/consent-view.tsx'
import { errorViewRender } from '#/components/error-view.tsx'
import { ButtonCooldown } from '#/components/forms/button-cooldown.tsx'
import { LayoutTitle } from '#/components/layouts/layout-title'
import { AuthenticationProvider } from '#/contexts/authentication.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import { NotificationsProvider } from '#/contexts/notifications.tsx'
import { SessionProvider, useSessionContext } from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'

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
  const [redirectUrl, setRedirectUrl] = useState<string | undefined>(undefined)
  const [isDone, setIsDone] = useState(false)

  const redirectTo = useCallback((url: string) => {
    console.debug('Redirecting back to client:', url)
    // @NOTE We use `window.location.replace` to prevent the user from coming
    // back. Also note that in the past, this was using `window.location.href =
    // url` which sometimes failed to perform the navigation.
    // https://github.com/bluesky-social/atproto/issues/5077
    window.location.replace(url)
  }, [])

  const performRedirect = useCallback(
    (url: string) => {
      // @NOTE At this point, the request data is no longer accessible. If the
      // user manages to reload the current page's url (eg. refresh), the
      // server's back-forward cache busting should prevent this page state from
      // being restored, and will result in an error page being displayed
      // ("Unknown request_uri"). If the user is "offline" (eg. network
      // disconnected), this cache busting by the backend will not work and the
      // browser may restore the page state.
      //
      // On a related note, client processing of the token response should be a
      // one time operation (because of nonce invalidation). So we should do our
      // best to prevent the navigation from being interrupted, or happening
      // more than once.
      //
      // This gets tricky as users may have a bad network connection, for which
      // we should do the best we can to help them complete the login process.
      //
      // We do this by first attempting to automatically redirect the user:
      redirectTo(url)

      // In case automatically redirecting fails, we will also show a link that
      // the user can click to continue. There is a long(ish) pause in between
      // the automatic redirect and the link being clickable, to give the
      // browser some time to perform the navigation and prevent the user from
      // clicking the link multiple times and causing multiple navigation
      // attempts.
      setRedirectUrl(url)

      // If, despite our best efforts, the client backend receives multiple
      // redirect requests, it should handle them gracefully: Either by
      // recognizing that the login process has already been completed for that
      // user (through the use of a cookie), or by revoking previous credentials
      // and triggering a new login process.

      // Prevent react from rendering the "redirecting..." view while the
      // browser is navigating by delaying the state update.
      setTimeout(() => setIsDone(true), 250)
    },
    [redirectTo],
  )

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
          <br />
          {redirectUrl && (
            <ButtonCooldown
              startWithCooldown
              cooldown={10}
              action={() => redirectTo(redirectUrl)}
            >
              <Trans>Click here if you are not automatically redirected</Trans>
            </ButtonCooldown>
          )}
        </LayoutTitle>
      )}
    </AuthenticationProvider>
  )
}
