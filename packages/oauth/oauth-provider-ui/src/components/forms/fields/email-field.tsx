import { useLingui } from '@lingui/react/macro'
import { MailIcon } from 'lucide-react'
import type { FieldValues } from 'react-hook-form'
import { TextField, type TextFieldProps } from './text-field.tsx'

export type EmailFieldProps<TValues extends FieldValues> =
  TextFieldProps<TValues>

export function EmailField<TValues extends FieldValues>({
  autoComplete = 'email',
  ...props
}: EmailFieldProps<TValues>) {
  const { t } = useLingui()

  return (
    <TextField
      icon={<MailIcon className="size-5" />}
      {...props}
      type="email"
      title={props.title ?? t`Email address`}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      dir="auto"
    />
  )
}
