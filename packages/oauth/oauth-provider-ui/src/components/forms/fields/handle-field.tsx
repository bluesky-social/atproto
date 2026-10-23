import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import { HANDLE_PATTERN, normalizeIdentifier } from '#/lib/form-patterns.ts'
import { TextField, type TextFieldProps } from './text-field.tsx'

export type HandleFieldProps = Omit<TextFieldProps, 'type' | 'pattern'> & {
  domains?: readonly string[]
}

export function HandleField({
  placeholder,
  domains,
  readOnly,
  title,
  label,
  autoCapitalize = 'none',
  autoCorrect = 'off',
  autoComplete = 'username',
  spellCheck = 'false',
  dir = 'auto',
  icon = <AtSignIcon className="size-5" />,
  onInput,
  onBlur,
  onKeyDown,
  ...props
}: HandleFieldProps) {
  const { t } = useLingui()

  return (
    <TextField
      {...props}
      icon={icon}
      type="text"
      title={title ?? t`Atmosphere handle`}
      label={label ?? <Trans>Username</Trans>}
      pattern={`\\s*(?:${HANDLE_PATTERN})\\s*`}
      placeholder={placeholder ?? t`alice${domains?.[0] ?? '.example.com'}`}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      dir={dir}
      readOnly={readOnly}
      onKeyDown={
        readOnly
          ? onKeyDown
          : (event) => {
              // @NOTE When submitting with "Enter", the order of the events is
              // "keydown" -> "input" -> "submit" -> "blur". So we need to
              // intercept the "Enter" key and normalize the value before the
              // form submits. Take the opportunity to normalize when other keys
              // are pressed as well.
              if (
                event.key === 'Tab' ||
                event.key === 'Escape' ||
                event.key === 'Enter'
              ) {
                const input = event.currentTarget
                input.value = normalizeIdentifier(input.value, domains)
              }
              return onKeyDown?.(event)
            }
      }
      onInput={
        readOnly
          ? onInput
          : (event) => {
              const input = event.currentTarget
              const spacesInFront = input.value.match(/^ */)?.[0].length ?? 0
              const selectionStart = input.selectionStart! - spacesInFront
              const selectionEnd = input.selectionEnd! - spacesInFront
              input.value = input.value.trim().toLowerCase()
              input.setSelectionRange(selectionStart, selectionEnd)
              return onInput?.(event)
            }
      }
      onBlur={
        readOnly
          ? onBlur
          : (event) => {
              const input = event.currentTarget
              input.value = normalizeIdentifier(input.value, domains)
              return onBlur?.(event)
            }
      }
    />
  )
}
