import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import { Override } from '#/lib/util.ts'
import { InputEmailAddress } from './forms/input-email-address'

export type ResetEmailConfirmFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (data: {
      token: string
      email: string
    }) => void | PromiseLike<void>
  }
>

export function ResetEmailConfirmForm({
  onSubmit,

  // FormCardAsyncProps
  invalid,
  ...props
}: ResetEmailConfirmFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | undefined>(undefined)

  return (
    <FormCardAsync
      {...props}
      onSubmit={async () => {
        if (token && email) return onSubmit({ token, email })
      }}
      invalid={invalid || !token || !email}
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
            if (token) inputRef.current?.focus()
          }}
        />
      </FormField>

      <FormField label={<Trans>New email</Trans>}>
        <InputEmailAddress
          ref={inputRef}
          name="email"
          enterKeyHint="done"
          required
          value={email}
          onEmail={setEmail}
        />
      </FormField>
    </FormCardAsync>
  )
}
