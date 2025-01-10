import { SyntheticEvent, useCallback, useState } from 'react'
import { useRandomString } from '../hooks/use-random-string'
import { Override } from '../lib/util'
import { Fieldset } from './fieldset'
import FormCardAsync, { FormCardAsyncProps } from './form-card-async'
import { AtSymbolIcon } from './icons/at-symbol-icon'
import { InputText } from './input-text'

export type ResetPasswordInitFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (email: string) => void | PromiseLike<void>

    emailDefault?: string
    emailLabel?: string
    emailAria?: string
    emailPlaceholder?: string
    emailTitle?: string
  }
>

export default function ResetPasswordInitForm({
  onSubmit,

  emailDefault = '',
  emailLabel = 'Enter your email address',
  emailAria = 'Enter the email you used to create your account. We\'ll send you a "reset code" so you can set a new password.',
  emailPlaceholder = emailLabel,
  emailTitle = 'Email address',

  ...props
}: ResetPasswordInitFormProps) {
  const emailAriaId = useRandomString({ prefix: 'reset-pwd-email-' })

  const [loading, setLoading] = useState(false)

  const doSubmit = useCallback(
    async (
      event: SyntheticEvent<
        HTMLFormElement & { email: HTMLInputElement },
        SubmitEvent
      >,
    ) => {
      event.preventDefault()
      await onSubmit(event.currentTarget.email.value)
    },
    [onSubmit],
  )

  return (
    <FormCardAsync {...props} onLoading={setLoading} onSubmit={doSubmit}>
      <Fieldset title={emailTitle} disabled={loading}>
        <InputText
          icon={<AtSymbolIcon className="w-5" />}
          name="email"
          type="email"
          placeholder={emailPlaceholder}
          aria-labelledby={emailAriaId}
          title={emailTitle}
          defaultValue={emailDefault}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email username"
          dir="auto"
          enterKeyHint="done"
          spellCheck="false"
          required
          autoFocus={true}
        />
        <p id={emailAriaId} className="text-sm mt-1">
          {emailAria}
        </p>
      </Fieldset>
    </FormCardAsync>
  )
}
