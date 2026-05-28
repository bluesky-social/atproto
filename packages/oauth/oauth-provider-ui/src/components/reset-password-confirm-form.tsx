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
    onSubmit: (data: {
      token: string
      password: string
    }) => void | PromiseLike<void>
  }
>

export function ResetPasswordConfirmForm({
  onSubmit,

  // FormCardAsyncProps
  invalid,
  children,
  ...props
}: ResetPasswordConfirmFormProps) {
  const passwordRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState<string | undefined>(undefined)

  return (
    <FormCardAsync
      {...props}
      invalid={!token || !password || invalid}
      onSubmit={async () => {
        if (token && password) await onSubmit({ token, password })
      }}
    >
      {children}

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
