import { useLingui } from '@lingui/react/macro'
import { ChangeEvent, useCallback, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../lib/password.ts'
import { Override } from '../../lib/util.ts'
import { PasswordStrengthLabel } from '../utils/password-strength-label.tsx'
import { PasswordStrengthMeter } from '../utils/password-strength-meter.tsx'
import { InputPassword, InputPasswordProps } from './input-password.tsx'

export type InputNewPasswordProps = Override<
  Omit<InputPasswordProps, 'value' | 'defaultValue'>,
  {
    password?: string
    onPassword?: (password: undefined | string) => void
  }
>

export function InputNewPassword({
  password: passwordInit = '',
  onPassword,

  // InputPasswordProps
  onChange,
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  ...props
}: InputNewPasswordProps) {
  const { t } = useLingui()
  const [password, setPassword] = useState<string>(passwordInit)

  const doChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      onChange?.(event)
      if (event.defaultPrevented) return
      setPassword(value)
      onPassword?.(event.target.validity.valid ? value : undefined)
    },
    [onChange, onPassword],
  )

  return (
    <InputPassword
      {...props}
      placeholder={t`Enter a password`}
      aria-label={t`Enter your new password`}
      title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
      minLength={minLength}
      onChange={doChange}
      value={password}
      autoComplete={autoComplete}
      bellow={
        <>
          <PasswordStrengthMeter password={password} />
          <PasswordStrengthLabel
            className="grow-1 min-w-max text-xs text-gray-500 dark:text-gray-400"
            password={password}
          />
        </>
      }
    />
  )
}
