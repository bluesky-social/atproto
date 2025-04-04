import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { PasswordStrength, getPasswordStrength } from '../../lib/password.ts'
import { Override } from '../../lib/util.ts'

export type PasswordStrengthMeterProps = Override<
  Omit<
    JSX.IntrinsicElements['div'],
    | 'children'
    | 'role'
    | 'aria-label'
    | 'aria-valuemin'
    | 'aria-valuemax'
    | 'aria-valuenow'
  >,
  {
    password: string
  }
>

export function PasswordStrengthMeter({
  password,

  // div
  className,
  ...props
}: PasswordStrengthMeterProps) {
  const { t } = useLingui()
  const strength = password ? getPasswordStrength(password) : 0

  const colorBg = 'bg-gray-300 dark:bg-slate-500'
  const color =
    strength === PasswordStrength.extra || strength === PasswordStrength.strong
      ? 'bg-success'
      : strength === PasswordStrength.moderate
        ? 'bg-warning'
        : 'bg-error'

  return (
    <div
      {...props}
      className={clsx('w-full h-1 flex space-x-2', className)}
      role="meter"
      aria-label={t`Password strength indicator`}
      aria-valuemin={0}
      aria-valuemax={PasswordStrength.extra}
      aria-valuenow={strength}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={`rounded h-1 w-1/4 ${strength > i ? color : colorBg}`}
        />
      ))}
    </div>
  )
}
