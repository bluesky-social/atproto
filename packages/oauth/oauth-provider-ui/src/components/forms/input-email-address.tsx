import { useLingui } from '@lingui/react/macro'
import { ChangeEvent, useCallback, useState } from 'react'
import { Override } from '../../lib/util.ts'
import { AtSymbolIcon } from '../utils/icons.tsx'
import { InputText, InputTextProps } from './input-text.tsx'

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
  icon = <AtSymbolIcon className="w-5" />,
  onBlur,
  onChange,
  pattern = '^[^@]+@[^@]+\\.[^@]+$',
  spellCheck = 'false',
  value,
  defaultValue = value,
  title,
  ...props
}: InputEmailAddressProps) {
  const { t } = useLingui()
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
      {...props}
      title={title ?? t`Email address`}
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
