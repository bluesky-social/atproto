import './style.css'

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { actionButton } from '#/components/forms/form-shell.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { CustomizationProvider } from '#/contexts/customization.tsx'
import type { HydrationData } from '#/hydration-data.d.ts'
import { cn } from '#/lib/utils.ts'
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
  const hostname = url.hostname

  // Shaped like the error view: heading, one line of copy, a hint, an action.
  return (
    <AuthShell
      title={msg`Cookies are blocked`}
      subtitle={
        <Trans>
          Sign-in needs cookies, and your browser isn't accepting them.
        </Trans>
      }
    >
      <form action={url.origin} method="GET" className="flex flex-col gap-5">
        {Array.from(new Map(url.searchParams)).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <p className="text-muted-foreground text-center text-sm leading-snug">
          <Trans>
            If this keeps happening, allow cookies for {hostname} in your
            browser's privacy settings.
          </Trans>
        </p>

        <Button type="submit" className={cn(actionButton, 'w-full')}>
          <Trans>Try again</Trans>
        </Button>
      </form>
    </AuthShell>
  )
}
