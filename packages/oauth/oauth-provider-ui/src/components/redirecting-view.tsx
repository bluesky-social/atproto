import { Trans } from '@lingui/react/macro'
import { PlayIcon } from '@phosphor-icons/react'
import { Ref } from 'react'
import {
  ButtonCooldown,
  ButtonCooldownHandler,
} from '#/components/forms/button-cooldown.tsx'
import {
  LayoutTitle,
  LayoutTitleProps,
} from '#/components/layouts/layout-title.tsx'
import { Override } from '#/lib/util.ts'

export type RedirectingHandler = ButtonCooldownHandler

export type RedirectingViewProps = Override<
  LayoutTitleProps,
  {
    retry?: () => void | PromiseLike<void>
    ref?: Ref<RedirectingHandler>
  }
>

export function RedirectingView({
  retry,
  ref,
  ...props
}: RedirectingViewProps) {
  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>

      {retry && (
        <ButtonCooldown
          startWithCooldown
          cooldown={10}
          ref={ref}
          action={retry}
          color="primary"
          idleIcon={PlayIcon}
          className="mt-4"
        >
          <Trans>Click here if you are not automatically redirected</Trans>
        </ButtonCooldown>
      )}
    </LayoutTitle>
  )
}
