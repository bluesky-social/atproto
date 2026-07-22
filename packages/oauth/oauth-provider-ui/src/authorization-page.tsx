import './style.css'

import { msg } from '@lingui/core/macro'
import { type ReactNode, StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { ConsentView } from '#/components/consent-view.tsx'
import { ErrorView } from '#/components/error-view.tsx'
import { ReactivateAccountView } from '#/components/reactivate-account-view'
import { RedirectingView } from '#/components/redirecting-view'
import {
  AuthenticationProvider,
  useAuthenticationContext,
} from '#/contexts/authentication.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import {
  NotificationsProvider,
  useNotificationsContext,
} from '#/contexts/notifications.tsx'
import { SessionProvider, useSessionContext } from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { sleep } from '#/lib/util.ts'
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
  window.history.replaceState(
    history.state,
    '',
    url.pathname + url.search + url.hash,
  )
}

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider userLocales={authorizeData.uiLocales?.split(' ')}>
        <NotificationsProvider>
          <ErrorBoundary
            fallbackRender={({ error, resetErrorBoundary }) => (
              <ErrorView error={error} retry={resetErrorBoundary} />
            )}
          >
            <SessionProvider
              initialSessions={initialSessions}
              initialSelected={authorizeData.selectedDid}
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

  const { notifyError } = useNotificationsContext()
  const { session, setSession, api } = useSessionContext()
  const [rejected, setRejected] = useState<null | boolean>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | undefined>(undefined)

  const initiateRedirect = useCallback(
    async (url: string, isRejected: boolean) => {
      // @NOTE Client processing of the token response should be a one time
      // operation (because of nonce invalidation). So we should do our best to
      // prevent the navigation from being interrupted, or happening more than
      // once. Using location.replace() is part of this effort. The cooldown
      // period in RedirectingView is another part of this effort.

      // @NOTE At this point, the request data is no longer accessible from the
      // back-end (because it was already "consented" / "rejected"). If the user
      // manages to reload the current page's url (eg. manages to navigate
      // "back"), the server's back-forward cache busting should prevent this
      // page state from being restored, and will result in an error page being
      // displayed ("Unknown request_uri"). If the user is "offline" (eg.
      // network disconnected), this cache busting by the backend might not
      // occur and the browser may restore the page state. For this reason, and
      // in order to provide a fallback behavior if the location.replace(url)
      // call fails,  we will show a link that the user can click to continue
      // after the automatic redirect attempt.

      // @NOTE  We want to redirect the user to the application ASAP but some
      // instances have shown that a small delay is needed to avoid the browser
      // blocking the redirect. If this is still an issue in the future, we
      // might want to consider reaching the /consent and /reject endpoints
      // using a form submission (followed by a 3xx redirect) instead of an XHR
      // request.
      //
      // https://github.com/bluesky-social/atproto/issues/5077
      await sleep(500)

      window.location.replace(url)

      // We wait a bit before showing the fallback link so that in case the
      // navigation is successful, the user won't see the link for a brief
      // moment before the page unloads.
      await sleep(100)

      // In case automatically redirecting fails, we will also show a link that
      // the user can click to continue. There is a long(ish) pause in between
      // the automatic redirect and the link being clickable, to give the
      // browser some time to perform the navigation and prevent the user from
      // clicking the link multiple times and causing multiple navigation
      // attempts.

      setRedirectUrl(url)
      setRejected(isRejected)

      // If, despite our best efforts, the client backend receives multiple
      // redirect requests, it should handle them gracefully: Either by
      // recognizing that the login process has already been completed for that
      // user (through the use of a cookie), or by revoking previous credentials
      // and triggering a new login process.
    },
    [],
  )

  const doConsentAndRedirect = useCallback(
    async ({ scope }: { scope?: string }) => {
      try {
        const { url } = await api.consent(session!.account.did, scope)
        await initiateRedirect(url, false)
      } catch (err) {
        notifyError(err)
        throw err
      }
    },
    [initiateRedirect, api, session],
  )

  const doRejectAndRedirect = useCallback(async () => {
    try {
      const { url } = await api.reject()
      await initiateRedirect(url, true)
    } catch (err) {
      notifyError(err)
      throw err
    }
  }, [initiateRedirect, api])

  if (redirectUrl) {
    return (
      <RedirectingView
        title={rejected ? msg`Login canceled` : msg`Login complete`}
        redirectUrl={redirectUrl}
        // We don't want the user to be able to click the back button and go
        // back to the consent screen after consenting/rejecting, so we replace
        // the history entry instead of pushing a new one.
        redirectMode="replace"
      />
    )
  }

  return (
    <AuthenticationProvider
      onCancel={doRejectAndRedirect}
      forcedIdentifier={loginHint}
      promptMode={authorizeData.promptMode}
    >
      <ActivatedAccountGate
        onCancel={
          // If the account is "forced" through a login hint, cancelling the
          // re-activation is equivalent to rejecting the consent. Otherwise,
          // cancelling takes the user back to the account selection.
          loginHint ? doRejectAndRedirect : () => setSession(null)
        }
      >
        {session && (
          // Note that the AuthenticationProvider acts as a gate that will
          // ensure that a "session" is available when its children are
          // rendered.
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
        )}
      </ActivatedAccountGate>
    </AuthenticationProvider>
  )
}

function ActivatedAccountGate({
  children,
  onCancel,
}: {
  children?: ReactNode
  onCancel?: () => void | PromiseLike<void>
}) {
  const { notify, notifyError } = useNotificationsContext()
  const { session, api } = useAuthenticationContext()

  if (session.account.deactivated) {
    const { did } = session.account
    return (
      <ReactivateAccountView
        account={session.account}
        onCancel={onCancel}
        onReactivate={async () => {
          try {
            await api.reactivateAccount({ did })
            notify({
              title: msg`Account reactivated`,
              description: msg`Your account has been successfully reactivated.`,
            })
          } catch (err) {
            notifyError(err)
          }
        }}
      />
    )
  }

  return <>{children}</>
}
