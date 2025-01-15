import { SyntheticEvent, useCallback, useState } from 'react'
import { useRandomString } from '../hooks/use-random-string'
import { Override } from '../lib/util'
import { Fieldset } from './fieldset'
import FormCardAsync, { FormCardAsyncProps } from './form-card-async'
import { LockIcon } from './icons/lock-icon'
import { InputOtp } from './input-otp'
import { InputText } from './input-text'

export type ResetPasswordConfirmFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (code: string, password: string) => void | PromiseLike<void>

    codeAria?: string
    codeLabel?: string
    codePlaceholder?: string
    codePattern?: string
    codeFormat?: string
    codeParseValue?: (value: string) => string | false

    passwordAria?: string
    passwordLabel?: string
    passwordPlaceholder?: string
    passwordPattern?: string
  }
>

export function ResetPasswordConfirmForm({
  onSubmit,

  codeLabel = 'Reset code',
  codeAria = 'You will receive an email with a "reset code". enter that code here then enter your new password.',

  passwordAria = 'Enter your new password',
  passwordLabel = 'New password',
  passwordPlaceholder = 'Enter a password',
  passwordPattern,

  ...props
}: ResetPasswordConfirmFormProps) {
  const codeAriaId = useRandomString({ prefix: 'reset-pwd-email-' })

  const [loading, setLoading] = useState(false)

  const [code, setCode] = useState<string | null>(null)
  const [password, setPassword] = useState<string>('')

  const doSubmit = async (
    event: SyntheticEvent<
      HTMLFormElement & {
        code: HTMLInputElement
        password: HTMLInputElement
      },
      SubmitEvent
    >,
  ) => {
    event.preventDefault()
    if (code && password) await onSubmit(code, password)
  }

  return (
    <FormCardAsync {...props} onLoading={setLoading} onSubmit={doSubmit}>
      <p id={codeAriaId} className="text-sm">
        {codeAria}
      </p>

      <Fieldset title={codeLabel} disabled={loading}>
        <InputOtp
          name="code"
          aria-labelledby={codeAriaId}
          enterKeyHint="next"
          required
          autoFocus={true}
          onOtp={setCode}
        />
      </Fieldset>

      <Fieldset title={passwordLabel} disabled={loading}>
        <InputText
          icon={<LockIcon className="w-5" />}
          name="password"
          type="password"
          placeholder={passwordPlaceholder}
          aria-labelledby={passwordAria}
          title={passwordLabel}
          pattern={passwordPattern}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="new-password"
          dir="auto"
          enterKeyHint="done"
          spellCheck="false"
          required
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </Fieldset>
    </FormCardAsync>
  )
}
