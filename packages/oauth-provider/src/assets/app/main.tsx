import './main.css'

import { createRoot } from 'react-dom/client'

import { authorizeData, errorData } from './backend-data'
import { AuthorizePage } from './components/authorize-page'
import { ErrorPage } from './components/error-page'

// When the user is logging in, make sure the page URL contains the
// "request_uri" in case the user refreshes the page.
const url = new URL(window.location.href)
if (authorizeData && url.pathname === '/oauth/authorize') {
  url.search = ''
  url.searchParams.set('client_id', authorizeData.clientId)
  url.searchParams.set('request_uri', authorizeData.requestUri)
  window.history.replaceState(history.state, '', url.pathname + url.search)
}

// TODO: inject brandingData (from backend-data.ts) into the page (logo & co)

const container = document.getElementById('root')!
const root = createRoot(container)

if (authorizeData) {
  root.render(<AuthorizePage {...authorizeData} />)
} else if (errorData) {
  root.render(<ErrorPage {...errorData} />)
} else {
  throw new Error('No data found')
}
