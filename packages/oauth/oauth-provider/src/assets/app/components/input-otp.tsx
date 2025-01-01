import { ChangeEvent, forwardRef } from 'react'
import { TokenIcon } from './icons/token-icon'
import { InputText, InputTextProps } from './input-text'

export type InputOtpProps = Omit<
  InputTextProps,
  | 'type'
  | 'pattern'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoComplete'
  | 'spellCheck'
  | 'minLength'
  | 'maxLength'
  | 'dir'
> & {
  example?: string
  onOtp?: (code: string | null) => void
}

export const OTP_CODE_EXAMPLE = 'XXXXX-XXXXX'

export const InputOtp = forwardRef<HTMLInputElement, InputOtpProps>(
  (
    {
      icon = <TokenIcon className="w-5" />,
      example = OTP_CODE_EXAMPLE,
      title = example,
      placeholder = `Looks like ${example}`,
      onChange,
      onOtp,
      ...props
    },
    ref,
  ) => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const { value, selectionEnd, selectionStart } = event.currentTarget

      const fixedValue = fix(value)

      event.currentTarget.value = fixedValue

      // Move the cursor back where it was relative to the original value
      const pos = selectionEnd ?? selectionStart
      if (pos != null) {
        const fixedSlicedValue = fix(value.slice(0, pos))
        event.currentTarget.selectionStart = event.currentTarget.selectionEnd =
          fixedSlicedValue.length
      }

      onChange?.(event)

      if (!event.isDefaultPrevented()) {
        onOtp?.(fixedValue.length === 11 ? fixedValue : null)
      }
    }

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
        ref={ref}
        icon={icon}
        pattern="^[A-Z2-7]{5}-[A-Z2-7]{5}$"
        placeholder={placeholder}
        title={title}
        onChange={handleChange}
      />
    )
  },
)

function fix(value: string) {
  const normalized = value.toUpperCase().replaceAll(/[^A-Z2-7]/g, '')

  if (normalized.length <= 5) return normalized

  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}
