import { useLingui } from '@lingui/react/macro'
import { ChangeEvent, useCallback, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../lib/password.ts'
import { Override } from '../../lib/util.ts'
import { ExpandTransition } from '../utils/expand-transition.tsx'
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
  onBlur,
  onChange,
  onFocus,
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  ...props
}: InputNewPasswordProps) {
  const { t } = useLingui()
  const [focused, setFocused] = useState(false)
  const [password, setPassword] = useState<string>(passwordInit)

  const doChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setPassword(value)
      onChange?.(event)
      onPassword?.(event.target.validity.valid ? value : undefined)
    },
    [onChange, onPassword],
  )

  return (
    <div>
      <InputPassword
        placeholder={t`Enter a password`}
        aria-label={t`Enter your new password`}
        title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
        minLength={minLength}
        onChange={doChange}
        onFocus={(event) => {
          onFocus?.(event)
          if (!event.defaultPrevented) setFocused(true)
        }}
        onBlur={(event) => {
          onBlur?.(event)
          if (!event.defaultPrevented) setFocused(false)
        }}
        value={password}
        autoComplete={autoComplete}
        {...props}
      />
      <ExpandTransition
        visible={focused && password.length > 0}
        className="flex flex-col"
      >
        <PasswordStrengthMeter className="mt-3" password={password} />
        <PasswordStrengthLabel
          className="text-xs mt-1 text-gray-500 dark:text-gray-400"
          password={password}
        />
      </ExpandTransition>
    </div>
  )
}
