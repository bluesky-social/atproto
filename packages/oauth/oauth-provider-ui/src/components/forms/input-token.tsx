import { TicketIcon } from '@phosphor-icons/react'
import { Override } from '#/lib/util.ts'
import { InputText, InputTextProps } from './input-text.tsx'

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
  icon = <TicketIcon className="w-5" weight="bold" />,
  title = example,
  onChange,
  ...props
}: InputTokenProps) {
  return (
    <InputText
      {...props}
      type="text"
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="one-time-code"
      spellCheck="false"
      minLength={11}
      maxLength={11}
      dir="auto"
      icon={icon}
      pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"
      placeholder={example}
      title={title}
      onChange={(event) => {
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

        onToken?.(fixedValue.length === 11 ? fixedValue : null)

        onChange?.(event)

        // If the change handler prevented the event, revert the value and cursor position
        if (event.defaultPrevented) {
          event.currentTarget.value = value
          event.currentTarget.selectionStart = selectionStart
          event.currentTarget.selectionEnd = selectionEnd
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
