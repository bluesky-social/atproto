import { Trans, useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import { PasswordStrength, getPasswordStrength } from '../../lib/password.ts'
import { Override } from '../../lib/util.ts'

export type PasswordStrengthLabelProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children' | 'aria-label'>,
  {
    password: string
  }
>

export function PasswordStrengthLabel({
  password,

  // span
  ...props
}: PasswordStrengthLabelProps) {
  const { t } = useLingui()
  const strength = getPasswordStrength(password)

  return (
    <span {...props} aria-label={t`Password strength`}>
      {strength === PasswordStrength.extra ? (
        <Trans>Extra</Trans>
      ) : strength === PasswordStrength.strong ? (
        <Trans>Strong</Trans>
      ) : strength === PasswordStrength.moderate ? (
        <Trans>Moderate</Trans>
      ) : password ? (
        <Trans>Weak</Trans>
      ) : (
        <Trans>Missing</Trans>
      )}
    </span>
  )
}
