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
  const strength = getPasswordStrength(password)

  const colorBg = 'bg-gray-300 dark:bg-slate-500'
  const color =
    strength === PasswordStrength.strong
      ? 'bg-success'
      : strength === PasswordStrength.moderate
        ? 'bg-warning'
        : 'bg-error'

  const count =
    strength === PasswordStrength.strong
      ? 3
      : strength === PasswordStrength.moderate
        ? 2
        : strength === PasswordStrength.weak
          ? 1
          : 0

  return (
    <div
      {...props}
      className={clsx('w-full h-1 flex space-x-2', className)}
      role="meter"
      aria-label={t`Password strength indicator`}
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={count}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className={`rounded h-1 w-1/3 ${count > i ? color : colorBg}`}
        />
      ))}
    </div>
  )
}
