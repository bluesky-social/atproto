import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import type { HydrationData } from './hydration-data.d.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { AuthorizeView } from './views/authorize/authorize-view.tsx'
import { ErrorView } from './views/error/error-view.tsx'

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
    <LocaleProvider userLocales={authorizeData.uiLocales?.split(' ')}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <ErrorView error={error} customizationData={customizationData} />
        )}
      >
        <AuthorizeView
          authorizeData={authorizeData}
          customizationData={customizationData}
          initialSessions={initialSessions}
        />
      </ErrorBoundary>
    </LocaleProvider>
  </StrictMode>,
)
