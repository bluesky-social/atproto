import { useLingui } from '@lingui/react/macro'
import { composeEventHandlers } from '@radix-ui/primitive'
import { useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '#/lib/password.ts'
import { Override } from '#/lib/util.ts'
import { PasswordStrengthLabel } from '../utils/password-strength-label.tsx'
import { PasswordStrengthMeter } from '../utils/password-strength-meter.tsx'
import { InputPassword, InputPasswordProps } from './input-password.tsx'

export type InputNewPasswordProps = Override<
  Omit<InputPasswordProps, 'defaultValue'>,
  {
    value?: string
    onPassword?: (password: undefined | string) => void
  }
>

export function InputNewPassword({
  value: valueInit = '',
  onPassword,

  // InputPasswordProps
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  onChange,
  ...props
}: InputNewPasswordProps) {
  const { t } = useLingui()
  const [value, setValue] = useState<string>(valueInit)

  return (
    <InputPassword
      {...props}
      placeholder={t`Enter a password`}
      aria-label={t`Enter your new password`}
      title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
      minLength={minLength}
      value={value}
      onChange={composeEventHandlers(onChange, (event) => {
        const { value } = event.target
        setValue(value)
        onPassword?.(event.target.validity.valid ? value : undefined)
      })}
      autoComplete={autoComplete}
      bellow={
        <>
          <PasswordStrengthMeter password={value} />
          <PasswordStrengthLabel
            className="grow-1 text-text-light min-w-max text-xs"
            password={value}
          />
        </>
      }
    />
  )
}
