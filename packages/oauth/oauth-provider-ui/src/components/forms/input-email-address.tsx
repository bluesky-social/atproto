import { useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
import { composeEventHandlers } from '@radix-ui/primitive'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { useRef, useState } from 'react'
import { Override } from '#/lib/util.ts'
import { InputText, InputTextProps } from './input-text.tsx'

export type InputEmailAddressProps = Override<
  Omit<InputTextProps, 'defaultValue' | 'type'>,
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
  icon = <AtIcon aria-hidden weight="bold" className="w-5" />,
  onChange,
  pattern = '^[^@]+@[^@]+\\.[^@]+$',
  spellCheck = 'false',
  value: valueInit = '',
  title,
  ref,
  ...props
}: InputEmailAddressProps) {
  const { t } = useLingui()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(valueInit)

  return (
    <InputText
      {...props}
      title={title ?? t`Email address`}
      ref={composeRefs(ref, inputRef)}
      type="email"
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      dir={dir}
      icon={icon}
      pattern={pattern}
      value={value}
      onChange={composeEventHandlers(onChange, (event) => {
        const { value } = event.target
        setValue(value)
        onEmail?.(event.target.validity.valid ? value.toLowerCase() : undefined)
      })}
    />
  )
}
