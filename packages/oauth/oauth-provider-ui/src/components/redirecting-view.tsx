import { Trans } from '@lingui/react/macro'
import {
  type MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  LayoutTitle,
  type LayoutTitleProps,
} from '#/components/layouts/layout-title.tsx'
import { useCountdown } from '#/hooks/use-countdown.ts'
import type { Override } from '#/lib/util.ts'
import { buttonClassName } from './forms/button.tsx'

export type RedirectingViewProps = Override<
  LayoutTitleProps,
  {
    redirectUrl: string
    redirectMode?: 'replace' | 'assign'
    /** Cooldown period before allowing manual redirect (in seconds) */
    redirectCooldown?: number
  }
>

export function RedirectingView({
  redirectUrl: url,
  redirectMode = 'assign',
  redirectCooldown = 5,

  // LayoutTitleProps
  ...props
}: RedirectingViewProps) {
  const [cooldown, setCooldown] = useCountdown(redirectCooldown)

  const canClick = cooldown === 0
  const [showLink, setShowLink] = useState(canClick)
  useEffect(() => {
    if (canClick) setShowLink(true)
  }, [canClick])

  // In order to provide a fallback when "replace" mode fails (eg. blocked by
  // the browser), we need to track how many times the user has clicked the
  // link. If they click it multiple times, we will allow the default navigation
  // behavior which will create a new history entry but at least get the user to
  // the right place.
  const clickCountRef = useRef(0)

  const onClick = useCallback<MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (!canClick) {
        // While the button is in cooldown, prevent any interaction
        event.preventDefault()
      } else {
        // Prevent the user from re-trying too soon
        setCooldown()

        // Track clicks
        clickCountRef.current++

        // In "replace" mode, we really want to try and replace the
        // history entry. If the user clicks the link, it means that the
        // auto redirect didn't work, so we will first try to redirect
        // using the same method as the auto redirect (which should
        // replace the history entry). If the user clicks the link
        // multiple times, we'll assume that the replace() approach is
        // being blocked by the browser, and we'll allow the default
        // navigation behavior which will create a new history entry but
        // at least get the user to the right place.
        if (redirectMode === 'replace' && clickCountRef.current < 2) {
          event.preventDefault()
          window.location.replace(url)
        }
      }
    },
    [canClick, setCooldown, redirectMode, url],
  )

  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>

      {showLink && (
        <a
          href={url}
          onClick={onClick}
          aria-disabled={!canClick}
          className={buttonClassName({ color: 'primary', disabled: !canClick })}
        >
          <span className="truncate">
            <Trans>Click here if nothing happens</Trans>
          </span>
        </a>
      )}
    </LayoutTitle>
  )
}
