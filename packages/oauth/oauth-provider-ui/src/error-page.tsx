import './style.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorView } from '#/components/error-view.tsx'
import { CustomizationProvider } from '#/contexts/customization'
import type { HydrationData } from '#/hydration-data.d.ts'
import { parseApiErrorPayload } from '#/lib/api.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'

const {
  //
  __errorData: errorData,
  __customizationData: customizationData,
} = window as typeof window & HydrationData['error-page']

// Attempt to turn the error data into an actual error instance if the error
// data has the shape of an API error response. This will allow the ErrorView to
// display the right error details and messages for known API errors.
const error = parseApiErrorPayload(errorData)

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider>
        <ErrorView error={error ?? errorData} />
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)
