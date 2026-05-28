import { Trans } from '@lingui/react/macro'
import { composeRefs } from '@radix-ui/react-compose-refs'
import { useRef, useState } from 'react'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import { Override } from '#/lib/util.ts'

export type VerifyEmailConfirmFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (data: { token: string }) => void | PromiseLike<void>
  }
>

export function VerifyEmailConfirmForm({
  onSubmit,

  // FormCardAsyncProps
  invalid,
  ref,
  children,
  ...props
}: VerifyEmailConfirmFormProps) {
  const [token, setToken] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement>(null)

  return (
    <FormCardAsync
      {...props}
      ref={composeRefs(ref, formRef)}
      invalid={!token || invalid}
      onSubmit={async () => {
        if (token) await onSubmit({ token })
      }}
    >
      {children}

      <FormField label={<Trans>Verification code</Trans>}>
        <InputToken
          name="code"
          enterKeyHint="done"
          required
          autoFocus={true}
          onToken={(value) => {
            formRef.current?.reset()
            setToken(value)
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
