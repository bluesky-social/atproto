import { useLingui } from '@lingui/react/macro'
import type { FieldValues } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { PasswordStrength } from '#/components/feedback/password-strength.tsx'
import { MIN_PASSWORD_LENGTH } from '#/lib/password.ts'
import { PasswordField, type PasswordFieldProps } from './password-field.tsx'

export type NewPasswordFieldProps<TValues extends FieldValues> =
  PasswordFieldProps<TValues>

export function NewPasswordField<TValues extends FieldValues>({
  control,
  name,
  autoComplete = 'new-password',
  minLength = MIN_PASSWORD_LENGTH,
  ...props
}: NewPasswordFieldProps<TValues>) {
  const { t } = useLingui()

  // @NOTE Subscribing to the live value here (rather than mirroring it in
  // local state) keeps the input itself fully controlled by react-hook-form
  // while still driving the strength meter.
  const value = useWatch({ control, name })

  return (
    <PasswordField
      {...props}
      control={control}
      name={name}
      placeholder={t`Enter a password`}
      aria-label={t`Enter your new password`}
      title={t`Password with at least ${MIN_PASSWORD_LENGTH} characters`}
      minLength={minLength}
      autoComplete={autoComplete}
      below={
        <PasswordStrength password={typeof value === 'string' ? value : ''} />
      }
    />
  )
}
