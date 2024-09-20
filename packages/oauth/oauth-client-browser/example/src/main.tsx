import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import { AuthProvider } from './auth/auth-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider
      clientId="http://localhost?redirect_uri=http%3A%2F%2F127.0.0.1%3A8080%2F&scope=atproto+transition%3Ageneric"
      // dev-env
      plcDirectoryUrl="http://localhost:2582"
      handleResolver="http://localhost:2584"
      // production
      // plcDirectoryUrl={undefined}
      // handleResolver="https://bsky.social"
    >
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
