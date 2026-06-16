import { Trans } from '@lingui/react/macro'
import { useCallback, useEffect, useState } from 'react'
import {
  LayoutTitle,
  LayoutTitleProps,
} from '#/components/layouts/layout-title.tsx'
import { useCountdown } from '#/hooks/use-countdown.ts'
import { Override } from '#/lib/util.ts'
import { buttonClassName } from './forms/button.tsx'

export type RedirectViewProps = Override<
  LayoutTitleProps,
  {
    url: string

    autoRedirect?: boolean | 'replace'
    autoRedirectDelay?: number
    autoRedirectInterval?: number

    manualRedirectInterval?: number
  }
>

export function RedirectView({
  url,

  autoRedirect: autoRedirectInit = false,
  autoRedirectDelay = 500,
  autoRedirectInterval = 5_000,

  manualRedirectInterval = 5_000,

  // LayoutTitleProps
  ...props
}: RedirectViewProps) {
  const [cooldown, setCooldown] = useCountdown(manualRedirectInterval / 1e3)
  const [showLink, setShowLink] = useState(cooldown === 0)
  const [autoRedirect, setAutoRedirect] = useState(autoRedirectInit)

  useEffect(() => {
    if (cooldown === 0) setShowLink(true)
  }, [cooldown])

  const redirectNow = useCallback(() => {
    if (autoRedirect === 'replace') {
      window.location.replace(url)
    } else {
      window.location.href = url
    }
  }, [autoRedirect, url])

  useEffect(() => {
    if (autoRedirect) {
      // First try is "immediate", then we retry every autoRedirectInterval
      // milliseconds
      let timer = setTimeout(() => {
        redirectNow()
        timer = setInterval(redirectNow, autoRedirectInterval)
      }, autoRedirectDelay)

      const cleanup = () => {
        window.removeEventListener('beforeunload', cleanup)
        clearTimeout(timer)
        clearInterval(timer)
      }

      // We really want to avoid redirecting multiple times
      window.addEventListener('beforeunload', cleanup)

      return cleanup
    }
  }, [autoRedirect, redirectNow])

  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>

      {showLink && (
        <a
          href={url}
          onClick={(event) => {
            if (cooldown > 0) event.preventDefault()
            else {
              // Stop the auto redirect
              setAutoRedirect(false)

              // Wait a little big before allowing the user to click again

              // @NOTE we use a setTimeout here to avoid a re-render during the
              // click event
              setTimeout(() => setCooldown(manualRedirectInterval), 1)
            }
          }}
          aria-disabled={cooldown > 0}
          className={buttonClassName({
            color: 'primary',
            disabled: cooldown > 0,
          })}
        >
          <Trans>Click here if you are not automatically redirected</Trans>
        </a>
      )}
    </LayoutTitle>
  )
}
