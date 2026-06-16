import { Trans } from '@lingui/react/macro'
import { useEffect, useState } from 'react'
import {
  LayoutTitle,
  LayoutTitleProps,
} from '#/components/layouts/layout-title.tsx'
import { useCountdown } from '#/hooks/use-countdown.ts'
import { Override } from '#/lib/util.ts'
import { buttonClassName } from './forms/button.tsx'

export type RedirectingViewProps = Override<
  LayoutTitleProps,
  {
    url: string
    cooldown?: number
    startWithCooldown?: boolean
  }
>

export function RedirectingView({
  url,
  cooldown: cooldownInit = 5,
  startWithCooldown = true,

  // LayoutTitleProps
  ...props
}: RedirectingViewProps) {
  const [cooldown, setCooldown] = useCountdown(
    startWithCooldown ? cooldownInit : 0,
  )
  const [showLink, setShowLink] = useState(cooldown === 0)

  useEffect(() => {
    if (cooldown === 0) setShowLink(true)
  }, [cooldown])

  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>

      {showLink && (
        <a
          href={url}
          onClick={(event) => {
            if (cooldown > 0) event.preventDefault()
            // @NOTE we use a setTimeout here to avoid a re-render during the click event
            else setTimeout(() => setCooldown(cooldownInit), 0)
          }}
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
