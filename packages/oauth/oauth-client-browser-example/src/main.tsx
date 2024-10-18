import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import { AuthProvider } from './auth/auth-provider'
import { ENV, HANDLE_RESOLVER_URL, PLC_DIRECTORY_URL } from './constants'

const clientId = `http://localhost?${new URLSearchParams({
  scope: 'atproto transition:generic',
  redirect_uri: Object.assign(new URL(window.location.origin), {
    hostname: '127.0.0.1',
    search: new URLSearchParams({
      env: ENV,
      handle_resolver: HANDLE_RESOLVER_URL,
      ...(PLC_DIRECTORY_URL && { plc_directory_url: PLC_DIRECTORY_URL }),
    }).toString(),
  }).href,
})}`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider
      clientId={clientId}
      plcDirectoryUrl={PLC_DIRECTORY_URL}
      handleResolver={HANDLE_RESOLVER_URL}
      allowHttp={ENV === 'development' || ENV === 'test'}
    >
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
