import './style.css'

import '#/locales/setup'

import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as ToastProvider } from '#/components/Toast'
import { Provider as LocaleProvider } from '#/locales'
import { routeTree } from '#/routeTree.gen'

const qc = new QueryClient()
const router = createRouter({
  routeTree,
  pathParamsAllowedCharacters: [':'],
})

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
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </LocaleProvider>
    </I18nProvider>
  </StrictMode>,
)
