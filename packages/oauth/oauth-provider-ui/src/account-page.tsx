import './style.css'

import { msg } from '@lingui/core/macro'
import { PaintBucketIcon } from '@phosphor-icons/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { errorViewRender } from '#/components/error-view.tsx'
import { Palette } from '#/components/utils/palette.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import { NotificationsProvider } from '#/contexts/notifications.tsx'
import { InitialSelectedSession, SessionProvider } from '#/contexts/session.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'
import { createRoutes as createAuthenticatedRoutes } from '#/routes/account/(authenticated)/route.tsx'
import { routes as unauthenticatedRoutes } from '#/routes/account/(unauthenticated)/routes.tsx'
import { RootRoute } from '#/routes/account.tsx'

const {
  __customizationData: customizationData,
  __deviceSessions: deviceSessions,
} = window as typeof window & HydrationData['account-page']

const qc = new QueryClient()

const authenticatedRoutes = createAuthenticatedRoutes('/account', {
  '/branding': {
    icon: PaintBucketIcon,
    hidden: true,
    position: 40,
    title: msg`Branding`,
    component: Palette,
  },
})

const router = createRouter({
  routeTree: RootRoute.addChildren([
    ...authenticatedRoutes,
    ...unauthenticatedRoutes,
  ]),
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider>
        <NotificationsProvider>
          <ErrorBoundary fallbackRender={errorViewRender}>
            <SessionProvider
              initialSessions={deviceSessions}
              initialSelected={InitialSelectedSession.Only}
            >
              <QueryClientProvider client={qc}>
                <RouterProvider router={router} />
              </QueryClientProvider>
            </SessionProvider>
          </ErrorBoundary>
        </NotificationsProvider>
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)
