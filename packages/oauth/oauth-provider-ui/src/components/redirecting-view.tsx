import { Trans } from '@lingui/react/macro'
import { ButtonCooldown } from '#/components/forms/button-cooldown.tsx'
import {
  LayoutTitle,
  LayoutTitleProps,
} from '#/components/layouts/layout-title'

export type RedirectingViewProps = LayoutTitleProps & {
  redirect?: () => void | PromiseLike<void>
}

export function RedirectingView({ redirect, ...props }: RedirectingViewProps) {
  return (
    <LayoutTitle {...props}>
      <Trans>You are being redirected...</Trans>
      <br />
      {redirect && (
        <ButtonCooldown startWithCooldown cooldown={10} action={redirect}>
          <Trans>Click here if you are not automatically redirected</Trans>
        </ButtonCooldown>
      )}
    </LayoutTitle>
  )
}
