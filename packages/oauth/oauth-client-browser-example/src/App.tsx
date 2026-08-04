import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, Suspense, useEffect } from 'react'
import { Home } from './Home.tsx'
import { Spinner } from './components/Spinner.js'
import { AuthenticationProvider } from './providers/AuthenticationProvider.tsx'
import {
  BskyClientProvider,
  useBskyClient,
} from './providers/BskyClientProvider.tsx'
import { OAuthProvider } from './providers/OAuthProvider.tsx'
import {
  PdsClientProvider,
  usePdsClient,
} from './providers/PdsClientProvider.tsx'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingView message="Authenticating..." />}>
        <OAuthProvider>
          <Suspense fallback={<LoadingView message="Loading preferences..." />}>
            <BskyClientProvider>
              <AuthenticationProvider>
                <PdsClientProvider>
                  <DevTools>
                    <Suspense fallback={<LoadingView />}>
                      <Home />
                    </Suspense>
                  </DevTools>
                </PdsClientProvider>
              </AuthenticationProvider>
            </BskyClientProvider>
          </Suspense>
        </OAuthProvider>
      </Suspense>
    </QueryClientProvider>
  )
}

function LoadingView({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <Spinner />
      {message}
    </div>
  )
}

function DevTools({ children }: { children?: ReactNode }) {
  const pdsClient = usePdsClient()
  const bskyClient = useBskyClient()

  useEffect(() => {
    const global = window as { pdsClient?: typeof pdsClient }
    global.pdsClient = pdsClient
    return () => {
      delete global.pdsClient
    }
  }, [pdsClient])

  useEffect(() => {
    const global = window as { bskyClient?: typeof bskyClient }
    global.bskyClient = bskyClient
    return () => {
      delete global.bskyClient
    }
  }, [bskyClient])

  return <>{children}</>
}
