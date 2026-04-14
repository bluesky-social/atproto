import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputNewPassword } from '#/components/forms/input-new-password.tsx'
import { InputToken } from '#/components/forms/input-token.tsx'
import { Override } from '#/lib/util.ts'

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
  }
>

export function ResetPasswordConfirmForm({
  onSubmit,

  // FormCardAsyncProps
  invalid,
  ...props
}: ResetPasswordConfirmFormProps) {
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
      <FormField label={<Trans>Reset code</Trans>}>
        <InputToken
          name="code"
          enterKeyHint="next"
          required
          autoFocus={true}
          onToken={(token) => {
            setToken(token)
            // Auto-focus next field when token is complete
            if (token) passwordRef.current?.focus()
          }}
        />
      </FormField>

      <FormField label={<Trans>New password</Trans>}>
        <InputNewPassword
          ref={passwordRef}
          name="password"
          enterKeyHint="done"
          required
          password={password}
          onPassword={setPassword}
        />
      </FormField>
    </FormCardAsync>
  )
}
