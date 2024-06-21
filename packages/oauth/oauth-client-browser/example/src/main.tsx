import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './app'
import { AuthProvider } from './auth/auth-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider
      handleResolver="http://localhost:2584" // dev-env
      plcDirectoryUrl="http://localhost:2582" // dev-env
    >
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
