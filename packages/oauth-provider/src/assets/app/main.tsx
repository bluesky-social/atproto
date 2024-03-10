import './main.css'

import { createRoot } from 'react-dom/client'

import { authorizeData, brandingData, errorData } from './backend-data'
import { App } from './app'
import { PageLayout } from './components/page-layout'
import { ErrorCard } from './components/error-card'

// When the user is logging in, make sure the page URL contains the
// "request_uri" in case the user refreshes the page.
const url = new URL(window.location.href)
if (authorizeData && url.pathname === '/oauth/authorize') {
  url.search = ''
  url.searchParams.set('client_id', authorizeData.clientId)
  url.searchParams.set('request_uri', authorizeData.requestUri)
  window.history.replaceState(history.state, '', url.pathname + url.search)
}

const container = document.getElementById('root')!
const root = createRoot(container)

if (authorizeData) {
  root.render(<App authorizeData={authorizeData} brandingData={brandingData} />)
} else if (errorData) {
  root.render(
    <PageLayout title="An error occurred">
      <ErrorCard {...errorData} className="max-w-lg w-full" />
    </PageLayout>,
  )
} else {
  throw new Error('No data found')
}
