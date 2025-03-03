import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app.tsx'
import { AuthProvider } from './auth/auth-provider.tsx'
import {
  ENV,
  HANDLE_RESOLVER_URL,
  PLC_DIRECTORY_URL,
  SIGN_UP_URL,
} from './constants.ts'

const clientId = `http://localhost?${new URLSearchParams({
  scope: 'atproto transition:generic',
  redirect_uri: Object.assign(new URL(window.location.origin), {
    hostname: '127.0.0.1',
    search: new URLSearchParams({
      env: ENV,
      handle_resolver: HANDLE_RESOLVER_URL,
      sign_up_url: SIGN_UP_URL,
      ...(PLC_DIRECTORY_URL && { plc_directory_url: PLC_DIRECTORY_URL }),
    }).toString(),
  }).href,
})}`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider
      clientId={clientId}
      plcDirectoryUrl={PLC_DIRECTORY_URL}
      signUpUrl={SIGN_UP_URL}
      handleResolver={HANDLE_RESOLVER_URL}
      allowHttp={ENV === 'development' || ENV === 'test'}
    >
      <App />
    </AuthProvider>
  </StrictMode>,
)
