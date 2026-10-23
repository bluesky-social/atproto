import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon } from 'lucide-react'
import {
  TextField,
  type TextFieldProps,
} from '#/components/forms/fields/text-field.tsx'
import { IDENTIFIER_PATTERN, normalizeIdentifier } from '#/lib/form-patterns.ts'

export type IdentifierFieldProps = Omit<TextFieldProps, 'type' | 'pattern'> & {
  domains?: readonly string[]
}

export function IdentifierField({
  domains = [],
  onInput,
  onBlur,
  onKeyDown,
  label,
  title,
  icon = <AtSignIcon className="size-5" />,
  placeholder,
  readOnly,
  autoCapitalize = 'none',
  autoCorrect = 'off',
  autoComplete = 'username',
  spellCheck = 'false',
  dir = 'auto',
  ...props
}: IdentifierFieldProps) {
  const { t } = useLingui()
  return (
    <TextField
      {...props}
      icon={icon}
      type="text"
      title={title ?? t`Username or email address`}
      label={label ?? <Trans>Username or Email</Trans>}
      pattern={`\\s*(?:${
        // @NOTE when domains are provided, we allow both handle segments
        // as normalizeIdentifier will add the default domain if missing.
        domains.length > 0 ? DOMAIN_LESS_IDENTIFIER_PATTERN : IDENTIFIER_PATTERN
      })\\s*`}
      placeholder={
        placeholder ??
        (domains.length > 0 ? t`you${domains[0]}` : t`alice@example.com`)
      }
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
