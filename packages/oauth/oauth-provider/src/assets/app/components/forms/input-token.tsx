import { ChangeEvent, useState } from 'react'
import { Override } from '../../lib/util'
import { TokenIcon } from '../utils/icons'
import { InputText, InputTextProps } from './input-text'

export type InputTokenProps = Override<
  Omit<
    InputTextProps,
    | 'type'
    | 'pattern'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'autoComplete'
    | 'spellCheck'
    | 'minLength'
    | 'maxLength'
    | 'placeholder'
    | 'dir'
  >,
  {
    example?: string
    onToken?: (code: string | null) => void
  }
>

export const OTP_CODE_EXAMPLE = 'XXXXX-XXXXX'

export function InputToken({
  example = OTP_CODE_EXAMPLE,
  onToken,

  // InputTextProps
  icon = <TokenIcon className="w-5" />,
  title = example,
  onChange,
  value,
  defaultValue = value,
  ...props
}: InputTokenProps) {
  const [token, setToken] = useState<string>(
    typeof defaultValue === 'string' ? defaultValue : '',
  )

  return (
    <InputText
      {...props}
      type="text"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck="false"
      minLength={11}
      maxLength={11}
      dir="auto"
      icon={icon}
      pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"
      // @TODO translate
      placeholder={`Looks like ${example}`}
      title={title}
      value={token}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const { value, selectionEnd, selectionStart } = event.currentTarget

        const fixedValue = fix(value)

        event.currentTarget.value = fixedValue

        // Move the cursor back where it was relative to the original value
        const pos = selectionEnd ?? selectionStart
        if (pos != null) {
          const fixedSlicedValue = fix(value.slice(0, pos))
          event.currentTarget.selectionStart =
            event.currentTarget.selectionEnd = fixedSlicedValue.length
        }

        setToken(fixedValue)
        onChange?.(event)

        if (!event.isDefaultPrevented()) {
          onToken?.(fixedValue.length === 11 ? fixedValue : null)
        }
      }}
    />
  )
}

function fix(value: string) {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')

  if (normalized.length <= 5) return normalized

  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}
