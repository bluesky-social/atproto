import './main.css'

import { createRoot } from 'react-dom/client'

import { App } from './app'
import { backendData } from './backend-data'

const url = new URL(window.location.href)
url.search = ''
url.searchParams.set('request_uri', backendData.requestUri)
url.searchParams.set('client_id', backendData.clientId)
window.history.replaceState(history.state, '', url.pathname + url.search)

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(<App {...backendData} />)
