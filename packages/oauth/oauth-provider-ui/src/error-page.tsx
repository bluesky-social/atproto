import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HydrationData } from './hydration-data.d.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { ErrorView } from './views/error/error-view.tsx'

const {
  //
  __errorData: errorData,
  __customizationData: customizationData,
} = window as typeof window & HydrationData['error-page']

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <LocaleProvider>
      <ErrorView error={errorData} customizationData={customizationData} />
    </LocaleProvider>
  </StrictMode>,
)
