import './main.css'

import { createRoot } from 'react-dom/client'

import { App } from './app'
import { backendData } from './backend-data'

const url = new URL(window.location.href)

// When the user is logging in, make sure the page URL contains the
// "request_uri" in case the user refreshes the page.
if (
  url.pathname === '/oauth/authorize' &&
  'clientId' in backendData &&
  'requestUri' in backendData
) {
  if (
    !url.searchParams.has('client_id') &&
    !url.searchParams.has('request_uri')
  ) {
    url.search = ''
    url.searchParams.set('client_id', backendData.clientId)
    url.searchParams.set('request_uri', backendData.requestUri)
    window.history.replaceState(history.state, '', url.pathname + url.search)
  }
}

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App {...backendData} />)
