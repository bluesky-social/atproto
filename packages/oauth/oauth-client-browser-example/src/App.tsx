import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './Home.tsx'
import { AuthenticationProvider } from './providers/AuthenticationProvider.tsx'
import { BskyClientProvider } from './providers/BskyClientProvider.tsx'

const queryClient = new QueryClient()

export function App() {
  return (
    <AuthenticationProvider>
      <BskyClientProvider>
        <QueryClientProvider client={queryClient}>
          <Home />
        </QueryClientProvider>
      </BskyClientProvider>
    </AuthenticationProvider>
  )
}
