import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect } from 'react'
import { Home } from './Home.tsx'
import * as lexicons from './lexicons.ts'
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
    <OAuthProvider>
      <QueryClientProvider client={queryClient}>
        <BskyClientProvider>
          <AuthenticationProvider>
            <PdsClientProvider>
              <DevTools>
                <Home />
              </DevTools>
            </PdsClientProvider>
          </AuthenticationProvider>
        </BskyClientProvider>
      </QueryClientProvider>
    </OAuthProvider>
  )
}

export function DevTools({ children }: { children?: ReactNode }) {
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

  useEffect(() => {
    const global = window as Partial<typeof lexicons>
    Object.assign(global, lexicons)
    return () => {
      for (const key of Object.keys(lexicons)) {
        delete global[key as keyof typeof lexicons]
      }
    }
  }, [lexicons])

  return <>{children}</>
}
