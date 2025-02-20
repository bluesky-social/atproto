import { useRef, useState } from 'react'
import { Fieldset } from '../../../components/forms/fieldset'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async'
import { InputNewPassword } from '../../../components/forms/input-new-password'
import { InputToken } from '../../../components/forms/input-token'
import { useRandomString } from '../../../hooks/use-random-string'
import { Override } from '../../../lib/util'

export type ResetPasswordConfirmFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (
      data: {
        token: string
        password: string
      },
      signal: AbortSignal,
    ) => void | PromiseLike<void>

    tokenPattern?: string
    tokenFormat?: string
    tokenParseValue?: (value: string) => string | false
  }
>

export function ResetPasswordConfirmForm({
  onSubmit,

  // FormCardAsyncProps
  invalid,
  ...props
}: ResetPasswordConfirmFormProps) {
  const tokenAriaId = useRandomString({ prefix: 'reset-pwd-email-' })
  const passwordRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState<string | undefined>(undefined)

  return (
    <FormCardAsync
      {...props}
      onSubmit={(signal) => {
        if (token && password) return onSubmit({ token, password }, signal)
      }}
      invalid={invalid || !token || !password}
    >
      <p id={tokenAriaId} className="text-sm">
        You will receive an email with a "reset code". enter that code here then
        enter your new password.
      </p>

      <Fieldset label="Reset code">
        <InputToken
          name="code"
          aria-label={tokenAriaId}
          enterKeyHint="next"
          required
          autoFocus={true}
          onToken={(token) => {
            setToken(token)
            // Auto-focus next field when token is complete
            if (token) passwordRef.current?.focus()
          }}
        />
      </Fieldset>

      <Fieldset label="New password">
        <InputNewPassword
          ref={passwordRef}
          name="password"
          enterKeyHint="done"
          required
          password={password}
          onPassword={setPassword}
        />
      </Fieldset>
    </FormCardAsync>
  )
}
