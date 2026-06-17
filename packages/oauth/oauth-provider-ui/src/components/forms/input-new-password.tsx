import { useLingui } from '@lingui/react/macro'
import { composeEventHandlers } from '@radix-ui/primitive'
import { useEffect, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '#/lib/password.ts'
import { Override } from '#/lib/util.ts'
import { PasswordStrengthLabel } from '../utils/password-strength-label.tsx'
import { PasswordStrengthMeter } from '../utils/password-strength-meter.tsx'
import { InputPassword, InputPasswordProps } from './input-password.tsx'

export type InputNewPasswordProps = Override<
  InputPasswordProps,
  {
    onPassword?: (password: undefined | string) => void
  }
>

export function InputNewPassword({
  // InputPasswordProps
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  onChange,
  ...props
}: InputNewPasswordProps) {
  const { t } = useLingui()

  const [current, setCurrent] = useState(
    props.defaultValue ?? props.value ?? '',
  )

  useEffect(() => {
    if (props.value !== undefined) {
      setCurrent(props.value)
    }
  }, [props.value])

  return (
    <InputPassword
      {...props}
      placeholder={t`Enter a password`}
      aria-label={t`Enter your new password`}
      title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
      minLength={minLength}
      onChange={composeEventHandlers(onChange, (event) => {
        setCurrent(event.target.value)
      })}
      autoComplete={autoComplete}
    >
      <PasswordStrengthMeter password={current} />
      <PasswordStrengthLabel
        className="grow-1 text-text-light min-w-max text-xs"
        password={current}
      />
    </InputPassword>
  )
}
