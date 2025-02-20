import { JSX } from 'react'
import { PasswordStrength, getPasswordStrength } from '../../lib/password'
import { Override } from '../../lib/util'

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
  const strength = getPasswordStrength(password)

  // TODO translate
  return (
    <span {...props} aria-label="Password strength">
      {strength === undefined
        ? 'Too short'
        : strength === PasswordStrength.strong
          ? 'Strong'
          : strength === PasswordStrength.moderate
            ? 'Moderate'
            : 'Weak'}
    </span>
  )
}
