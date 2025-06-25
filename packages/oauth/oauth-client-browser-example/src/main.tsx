import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app.tsx'
import { AuthProvider } from './auth/auth-provider.tsx'
import {
  ENV,
  HANDLE_RESOLVER_URL,
  OAUTH_SCOPE,
  PLC_DIRECTORY_URL,
  SIGN_UP_URL,
} from './constants.ts'

const clientId = `http://localhost?${new URLSearchParams({
  scope: OAUTH_SCOPE,
  redirect_uri: Object.assign(new URL(window.location.origin), {
    hostname: '127.0.0.1',
    search: new URLSearchParams({
      env: ENV,
      handle_resolver: HANDLE_RESOLVER_URL,
      sign_up_url: SIGN_UP_URL,
      scope: OAUTH_SCOPE,
      ...(PLC_DIRECTORY_URL && { plc_directory_url: PLC_DIRECTORY_URL }),
    }).toString(),
  }).href,
})}`

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        clientId={clientId}
        plcDirectoryUrl={PLC_DIRECTORY_URL}
        signUpUrl={SIGN_UP_URL}
        handleResolver={HANDLE_RESOLVER_URL}
        allowHttp={ENV === 'development' || ENV === 'test'}
      >
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
