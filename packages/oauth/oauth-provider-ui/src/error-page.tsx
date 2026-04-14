import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorView } from '#/components/error-view.tsx'
import { CustomizationProvider } from '#/contexts/customization'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'

const {
  //
  __errorData: errorData,
  __customizationData: customizationData,
} = window as typeof window & HydrationData['error-page']

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider>
        <ErrorView error={errorData} />
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)
