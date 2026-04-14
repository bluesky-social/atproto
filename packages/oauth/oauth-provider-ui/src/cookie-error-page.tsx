import './style.css'

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '#/components/forms/button.tsx'
import { FormCard } from '#/components/forms/form-card.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'
import { LayoutApp } from './components/layouts/layout-app'

const {
  //
  __continueUrl: continueUrl,
  __customizationData: customizationData,
} = window as typeof window & HydrationData['cookie-error-page']

const container = document.getElementById('root')!

createRoot(container).render(
  <StrictMode>
    <CustomizationProvider value={customizationData}>
      <LocaleProvider>
        <CookieErrorView />
      </LocaleProvider>
    </CustomizationProvider>
  </StrictMode>,
)

function CookieErrorView() {
  const url = new URL(continueUrl)

  return (
    <LayoutApp title={msg`Cookie Error`}>
      <FormCard
        action={url.origin}
        method="GET"
        actions={
          <Button type="submit" color="primary">
            <Trans>Continue</Trans>
          </Button>
        }
        className="w-xl"
      >
        {Array.from(new Map(url.searchParams)).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <Admonition role="status">
          <Trans>
            It seems that your browser is not accepting cookies. Press
            "Continue" to try again. If the error persists, please ensure that
            your privacy settings allow cookies for the "{url.hostname}"
            website.
          </Trans>
        </Admonition>
      </FormCard>
    </LayoutApp>
  )
}
