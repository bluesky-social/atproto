// The imports from backend-data are marked as deprecated to avoid their use
// from other places.
/* eslint-disable import/no-deprecated */

// This must be loaded before any dependency to ensure that global variables
// cannot be accessed by other bundled JS files from node_modules:
// eslint-disable-next-line import/order
import {
  authorizeData,
  availableLocales,
  customizationData,
  errorData,
} from './backend-data.ts'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'

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
    <App
      availableLocales={availableLocales}
      authorizeData={authorizeData}
      customizationData={customizationData}
      errorData={errorData}
    />
  </StrictMode>,
)
