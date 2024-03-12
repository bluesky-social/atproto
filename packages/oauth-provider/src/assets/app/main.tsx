import './main.css'

import { createRoot } from 'react-dom/client'

import { App } from './app'
import * as backendData from './backend-data'
import { authorizeData } from './backend-data'

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
const root = createRoot(container)
root.render(<App {...backendData} />)
