import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import type {
  AuthorizeData,
  AvailableLocales,
  CustomizationData,
} from '@atproto/oauth-provider-api'
import { readBackendData } from './lib/backend-data.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { AuthorizeView } from './views/authorize/authorize-view.tsx'
import { ErrorView } from './views/error/error-view.tsx'

export const availableLocales =
  readBackendData<AvailableLocales>('__availableLocales')
export const customizationData = readBackendData<CustomizationData>(
  '__customizationData',
)
export const authorizeData = readBackendData<AuthorizeData>('__authorizeData')

if (authorizeData) {
  // When the user is logging in, make sure the page URL contains the
  // "request_uri" in case the user refreshes the page.
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
}

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <LocaleProvider availableLocales={availableLocales}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <ErrorView error={error} customizationData={customizationData} />
        )}
      >
        <AuthorizeView
          customizationData={customizationData}
          authorizeData={authorizeData}
        />
      </ErrorBoundary>
    </LocaleProvider>
  </StrictMode>,
)
