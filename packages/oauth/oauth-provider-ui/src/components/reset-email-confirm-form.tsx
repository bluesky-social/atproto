import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'
import { InputEmailAddress } from './forms/input-email-address.tsx'

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
  ref,
  children,
  ...props
}: ResetEmailConfirmFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | undefined>(undefined)

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      invalid={!token || !email || invalid}
      onSubmit={() => {
        if (token && email) return onSubmit({ token, email })
      }}
    >
      {children}

      <FormField label={<Trans>Reset code</Trans>}>
        <InputToken
          name="code"
          enterKeyHint="next"
          required
          autoFocus={true}
          onToken={(value) => {
            formRef.current?.reset()
            setToken(value)
            // Auto-focus next field when token is complete
            if (value) inputRef.current?.focus()
          }}
        />
      </FormField>

      <FormField label={<Trans>New email address</Trans>}>
        <InputEmailAddress
          ref={inputRef}
          name="email"
          enterKeyHint="done"
          required
          value={email}
          onEmail={(value) => {
            formRef.current?.reset()
            setEmail(value)
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
