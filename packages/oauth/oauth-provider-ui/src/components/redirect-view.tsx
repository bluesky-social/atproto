import { Trans } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
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
    manualRedirectCooldown?: number
  }
>

export function RedirectView({
  url,

  autoRedirect = false,
  autoRedirectDelay = 500, // milliseconds

  manualRedirectCooldown = 5, // seconds

  // LayoutTitleProps
  ...props
}: RedirectViewProps) {
  const [cooldown, setCooldown] = useCountdown(manualRedirectCooldown)
  const [showLink, setShowLink] = useState(cooldown === 0)

  useEffect(() => {
    if (cooldown === 0) setShowLink(true)
  }, [cooldown])

  // We need a ref to be able to cancel the auto redirect when the user clicks
  // the link to manually redirect.
  const cancelAutoRedirect = useRef(() => {})

  useEffect(() => {
    if (autoRedirect) {
      const timer = setTimeout(() => {
        if (autoRedirect === 'replace') {
          window.location.replace(url)
        } else {
          window.location.href = url
        }
      }, autoRedirectDelay)

      const cancel = () => {
        clearTimeout(timer)
      }

      // We really want to avoid redirecting multiple times
      window.addEventListener('beforeunload', cancel)

      // Allow cancelling from outside the effect
      cancelAutoRedirect.current = cancel

      return () => {
        cancel()
        window.removeEventListener('beforeunload', cancel)
        if (cancelAutoRedirect.current === cancel) {
          cancelAutoRedirect.current = () => {}
        }
      }
    }
  }, [autoRedirect, url])

  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>

      {showLink && (
        <a
          href={url}
          onClick={(event) => {
            if (cooldown > 0) event.preventDefault()
            else {
              // Prevent the auto redirect
              cancelAutoRedirect.current()

              // Wait a little bit before allowing the user to click again
              setCooldown(manualRedirectCooldown)
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
