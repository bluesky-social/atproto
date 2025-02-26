import { ChangeEvent, useCallback, useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../lib/password'
import { Override } from '../../lib/util'
import { ExpandTransition } from '../utils/expand-transition'
import { PasswordStrengthLabel } from '../utils/password-strength-label'
import { PasswordStrengthMeter } from '../utils/password-strength-meter'
import { InputPassword, InputPasswordProps } from './input-password'

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
        placeholder="Enter a password"
        aria-label="Enter your new password"
        title={`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
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
        <PasswordStrengthMeter className="mt-2" password={password} />
        <PasswordStrengthLabel
          className="self-end text-xs"
          password={password}
        />
      </ExpandTransition>
    </div>
  )
}
