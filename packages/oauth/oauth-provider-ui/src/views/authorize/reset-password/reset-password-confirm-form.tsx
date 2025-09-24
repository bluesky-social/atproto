import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { Fieldset } from '../../../components/forms/fieldset.tsx'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async.tsx'
import { InputNewPassword } from '../../../components/forms/input-new-password.tsx'
import { InputToken } from '../../../components/forms/input-token.tsx'
import { Admonition } from '../../../components/utils/admonition.tsx'
import { useRandomString } from '../../../hooks/use-random-string.ts'
import { Override } from '../../../lib/util.ts'

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
      <Admonition id={tokenAriaId} type="status">
        <Trans>
          You will receive an email with a "reset code". Enter that code here
          then enter your new password.
        </Trans>
      </Admonition>

      <Fieldset label={<Trans>Reset code</Trans>}>
        <InputToken
          name="code"
          aria-labelledby={tokenAriaId}
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

      <Fieldset label={<Trans>New password</Trans>}>
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
