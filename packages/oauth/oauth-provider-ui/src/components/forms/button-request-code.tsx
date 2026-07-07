import { Trans } from '@lingui/react/macro'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import {
  ButtonCooldown,
  type ButtonCooldownProps,
} from '#/components/forms/button-cooldown.tsx'

export type ButtonRequestCodeProps = ButtonCooldownProps

export function ButtonRequestCode({
  children = <Trans>Send verification code</Trans>,
  ...props
}: ButtonRequestCodeProps) {
  return (
    <ButtonCooldown idleIcon={PaperPlaneTiltIcon} {...props}>
      <span className="truncate">{children}</span>
    </ButtonCooldown>
  )
}
