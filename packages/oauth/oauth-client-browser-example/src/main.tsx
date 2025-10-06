import './index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-types'
import App from './app.tsx'
import { AuthProvider } from './auth/auth-provider.tsx'
import {
  ENV,
  HANDLE_RESOLVER_URL,
  LOOPBACK_CANONICAL_LOCATION,
  OAUTH_SCOPE,
  PLC_DIRECTORY_URL,
  SIGN_UP_URL,
} from './constants.ts'

const clientMetadata = buildAtprotoLoopbackClientMetadata({
  scope: OAUTH_SCOPE,
  redirect_uris: [LOOPBACK_CANONICAL_LOCATION],
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        clientMetadata={clientMetadata}
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
