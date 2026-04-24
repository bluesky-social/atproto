import { Trans } from '@lingui/react/macro'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import {
  ButtonCooldown,
  ButtonCooldownProps,
} from '#/components/forms/button-cooldown.tsx'

export type ButtonRequestResetProps = ButtonCooldownProps

export function ButtonRequestReset({ ...props }: ButtonRequestResetProps) {
  return (
    <ButtonCooldown {...props}>
      <PaperPlaneTiltIcon aria-hidden className="mr-2" weight="bold" />
      <span className="flex-1 truncate">
        <Trans context="PasswordReset">Send reset code</Trans>
      </span>
    </ButtonCooldown>
  )
}
