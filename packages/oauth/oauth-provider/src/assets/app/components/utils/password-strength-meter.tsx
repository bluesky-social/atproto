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
  const strength = getPasswordStrength(password)

  const colorBg = 'bg-gray-200 dark:bg-slate-400'
  const color =
    strength === PasswordStrength.strong
      ? 'bg-success'
      : strength === PasswordStrength.moderate
        ? 'bg-warning'
        : 'bg-error'

  const count =
    strength === PasswordStrength.strong
      ? 4
      : strength === PasswordStrength.moderate
        ? 3
        : strength === PasswordStrength.weak
          ? 2
          : 1

  return (
    <div
      {...props}
      className={clsx('w-full h-1 flex space-x-2', className)}
      role="meter"
      aria-label="Password strength indicator"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={count}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className={`rounded h-1 w-1/4 ${count > i ? color : colorBg}`}
        />
      ))}
    </div>
  )
}
