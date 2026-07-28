import './style.css'

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Notice } from '#/components/feedback/notice.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { LocaleProvider } from '#/locales/locale-provider.tsx'

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
    <AuthShell title={msg`Cookie Error`}>
      {/* @NOTE The Notice drops its own title: the shell's card heading
        already reads "Cookie Error", and the two stacked directly on top of
        each other. The msgid survives — the page title uses the same string.

        `w-xl` is gone too; the shell caps the column at `max-w-sm`, and a
        fixed width fought it. */}
      <form action={url.origin} method="GET" className="flex flex-col gap-4">
        {Array.from(new Map(url.searchParams)).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        {/* @NOTE `role` drives the a11y semantics, `variant` the styling, and
          they are set apart deliberately here: this is still an alert, but the
          amber caution treatment is redundant when the card heading already
          says "Cookie Error" and the notice is the only thing on the page. */}
        <Notice role="alert" variant="info">
          <Trans>
            It seems that your browser is not accepting cookies. Press
            "Continue" to try again. If the error persists, please ensure that
            your privacy settings allow cookies for the "{url.hostname}"
            website.
          </Trans>
        </Notice>

        <Button type="submit" className="w-full">
          <Trans>Continue</Trans>
        </Button>
      </form>
    </AuthShell>
  )
}
