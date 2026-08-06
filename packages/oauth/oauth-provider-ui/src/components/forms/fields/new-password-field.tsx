import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { PasswordStrength } from '#/components/feedback/password-strength.tsx'
import { MIN_PASSWORD_LENGTH } from '#/lib/password.ts'
import { PasswordField, type PasswordFieldProps } from './password-field.tsx'

export type NewPasswordFieldProps = PasswordFieldProps

export function NewPasswordField({
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  onChange,
  defaultValue,
  ...props
}: NewPasswordFieldProps) {
  const { t } = useLingui()

  // @NOTE Mirrored locally only to drive the strength meter; the input itself
  // stays uncontrolled so the DOM remains the source of truth. Seeded from
  // `defaultValue` so the meter matches a restored value.
  const [value, setValue] = useState(
    typeof defaultValue === 'string' ? defaultValue : '',
  )

  return (
    <PasswordField
      {...props}
      defaultValue={defaultValue}
      placeholder={t`Enter a password`}
      aria-label={t`Enter your new password`}
      title={t`Password with at least ${plural(MIN_PASSWORD_LENGTH, {
        other: '# characters',
      })}`}
      minLength={minLength}
      autoComplete={autoComplete}
      onChange={(event) => {
        onChange?.(event)
        setValue(event.currentTarget.value)
      }}
      below={<PasswordStrength password={value} />}
    />
  )
}
