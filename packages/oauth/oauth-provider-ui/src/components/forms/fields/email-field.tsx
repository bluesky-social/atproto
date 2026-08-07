import { useLingui } from '@lingui/react/macro'
import { MailIcon } from 'lucide-react'
import { EMAIL_PATTERN } from '#/lib/form-patterns.ts'
import { TextField, type TextFieldProps } from './text-field.tsx'

export type EmailFieldProps = Omit<
  TextFieldProps,
  'type' | 'autoCapitalize' | 'autoCorrect' | 'dir' | 'spellCheck'
>

export function EmailField({
  autoComplete = 'email',
  // @NOTE `type="email"` alone accepts `user@host` without a dot; the pattern
  // additionally requires a domain with a TLD.
  pattern = EMAIL_PATTERN,
  ...props
}: EmailFieldProps) {
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
      pattern={pattern}
    />
  )
}
