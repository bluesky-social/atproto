import { useLingui } from '@lingui/react/macro'
import { ChangeEvent, useCallback, useRef, useState } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { MIN_PASSWORD_LENGTH } from '../../lib/password.ts'
import { mergeRefs } from '../../lib/ref.ts'
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
  ref,
  onChange,
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  ...props
}: InputNewPasswordProps) {
  const { t } = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)
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
    <div
      className={clsx(
        'bg-gray-200 dark:bg-slate-700',
        'rounded-lg',
        'overflow-hidden',
      )}
    >
      <InputPassword
        ref={mergeRefs([ref, inputRef])}
        className="rounded-br-none rounded-bl-none"
        placeholder={t`Enter a password`}
        aria-label={t`Enter your new password`}
        title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
        minLength={minLength}
        onChange={doChange}
        value={password}
        autoComplete={autoComplete}
        {...props}
      />

      <div
        onClick={() => inputRef.current?.focus()}
        className={clsx(
          'flex flex-row items-center gap-1',
          'text-sm italic',
          'text-gray-700 dark:text-gray-300',
          'px-3 py-2 space-x-2',
        )}
      >
        <PasswordStrengthMeter password={password} />
        <PasswordStrengthLabel
          className="grow-1 min-w-max text-xs text-gray-500 dark:text-gray-400"
          password={password}
        />
      </div>
    </div>
  )
}
