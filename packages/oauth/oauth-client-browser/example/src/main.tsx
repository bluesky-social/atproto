import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import { AuthProvider } from './auth/auth-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider
      // dev-env
      plcDirectoryUrl="http://localhost:2582"
      handleResolver="http://localhost:2584"
      // production
      // plcDirectoryUrl={undefined}
      // handleResolver="https://bsky.social"
      getScope={() => 'atproto transition:generic'}
    >
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
