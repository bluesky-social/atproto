import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type {
  AvailableLocales,
  CustomizationData,
  ErrorData,
} from '@atproto/oauth-provider-api'
import { readHydrationData } from './lib/read-hydration-data.ts'
import { LocaleProvider } from './locales/locale-provider.tsx'
import { ErrorView } from './views/error/error-view.tsx'

export const availableLocales =
  readHydrationData<AvailableLocales>('__availableLocales')
export const customizationData = readHydrationData<CustomizationData>(
  '__customizationData',
)
export const errorData = readHydrationData<ErrorData>('__errorData')

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <LocaleProvider availableLocales={availableLocales}>
      <ErrorView error={errorData} customizationData={customizationData} />
    </LocaleProvider>
  </StrictMode>,
)
