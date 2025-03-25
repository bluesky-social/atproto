import '#/locales/setup'
import '#/data/useHydrationData/initialize'

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { routeTree } from '#/routeTree.gen'
import { Provider as LocaleProvider } from '#/locales'

const qc = new QueryClient()
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <LocaleProvider>
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LocaleProvider>
    </I18nProvider>
  </StrictMode>,
)
