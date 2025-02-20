import { ChangeEvent, useCallback, useState } from 'react'
import { Override } from '../../lib/util'
import { LockIcon } from '../utils/icons'
import { InputText, InputTextProps } from './input-text'

export type InputEmailAddressProps = Override<
  Omit<InputTextProps, 'type'>,
  {
    onEmail?: (email: string | undefined) => void
  }
>

export function InputEmailAddress({
  onEmail,

  // InputTextProps
  autoCapitalize = 'none',
  autoComplete = 'email',
  autoCorrect = 'off',
  dir = 'auto',
  icon = <LockIcon className="w-5" />,
  onBlur,
  onChange,
  pattern = '^[^@]+@[^@]+\\.[^@]+$',
  spellCheck = 'false',
  value,
  defaultValue = value,
  ...props
}: InputEmailAddressProps) {
  const [email, setEmail] = useState<string>(
    typeof defaultValue === 'string' ? defaultValue : '',
  )

  const doChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const email = event.target.value.toLowerCase()

      setEmail(email)
      onChange?.(event)
      onEmail?.(event.target.validity.valid ? email : undefined)
    },
    [onChange, onEmail],
  )

  return (
    <InputText
      // @TODO translate
      aria-label="Email"
      placeholder="Email"
      title="Email"
      {...props}
      type="email"
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      dir={dir}
      spellCheck={spellCheck}
      icon={icon}
      pattern={pattern}
      autoComplete={autoComplete}
      value={email}
      onChange={doChange}
      onBlur={onBlur}
    />
  )
}
