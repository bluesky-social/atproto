import './style.css'

import type { HydrationData } from '#/hydration-data.d.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { CookieErrorView } from './views/error/cookie-error-view.tsx'

const {
  //
  __continueUrl: continueUrl,
  __customizationData: customizationData,
} = window as typeof window & HydrationData['cookie-error-page']

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <LocaleProvider>
      <CookieErrorView
        continueUrl={continueUrl}
        customizationData={customizationData}
      />
    </LocaleProvider>
  </StrictMode>,
)
