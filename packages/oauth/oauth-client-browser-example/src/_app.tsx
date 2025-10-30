import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './Home.tsx'
import { oauthClient } from './oauthClient.ts'
import { OAuthProvider } from './providers/OAuthProvider.tsx'
import { SignedInProvider } from './providers/SignedInProvider.tsx'

const queryClient = new QueryClient()

export function App() {
  return (
    <OAuthProvider client={oauthClient}>
      <QueryClientProvider client={queryClient}>
        <SignedInProvider>
          <Home />
        </SignedInProvider>
      </QueryClientProvider>
    </OAuthProvider>
  )
}
