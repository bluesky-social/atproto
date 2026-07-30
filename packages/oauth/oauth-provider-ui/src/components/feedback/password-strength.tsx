import { Trans, useLingui } from '@lingui/react/macro'
import type { JSX } from 'react'
import {
  PasswordStrength as Strength,
  getPasswordStrength,
} from '#/lib/password.ts'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type PasswordStrengthProps = Override<
  Omit<JSX.IntrinsicElements['div'], 'children'>,
  {
    password: string
  }
>

const segmentColor: Record<number, string> = {
  0: 'bg-muted',
  [Strength.weak]: 'bg-destructive',
  [Strength.moderate]: 'bg-warning',
  [Strength.strong]: 'bg-success',
  [Strength.extra]: 'bg-success',
}

/** A segmented strength meter and its label. */
export function PasswordStrength({
  password,
  className,
  ...props
}: PasswordStrengthProps) {
  const { t } = useLingui()
  const strength = password ? getPasswordStrength(password) : 0
  const filled = segmentColor[strength] ?? 'bg-muted'

  return (
    <div {...props} className={cn('flex items-center gap-3', className)}>
      <div
        className="flex h-1 w-full space-x-2"
        role="meter"
        aria-label={t`Password strength indicator`}
        aria-valuemin={0}
        aria-valuemax={Strength.extra}
        aria-valuenow={strength}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 w-1/4 rounded-sm',
              strength > i ? filled : 'bg-muted',
            )}
          />
        ))}
      </div>

      <span
        className="text-muted-foreground min-w-max grow text-xs"
        aria-label={t`Password strength`}
      >
        {strength === Strength.extra ? (
          <Trans>Extra</Trans>
        ) : strength === Strength.strong ? (
          <Trans>Strong</Trans>
        ) : strength === Strength.moderate ? (
          <Trans>Moderate</Trans>
        ) : password ? (
          <Trans>Weak</Trans>
        ) : (
          <Trans>Missing</Trans>
        )}
      </span>
    </div>
  )
}
