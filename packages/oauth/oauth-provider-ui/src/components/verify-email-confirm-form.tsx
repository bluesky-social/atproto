import { Trans } from '@lingui/react/macro'
import { useCallback, useRef, useState } from 'react'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputToken } from '#/components/forms/input-token.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'

export type VerifyEmailConfirmFormProps = Override<
  FormCardAsyncProps,
  {
    onSubmit: (
      data: { token: string },
      signal: AbortSignal,
    ) => void | PromiseLike<void>
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

  const ctrlRef = useRef<AsyncActionController>(null)

  const doSubmit = useCallback(
    (signal: AbortSignal) => {
      if (token) return onSubmit({ token }, signal)
    },
    [token, onSubmit],
  )

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, ctrlRef])}
      onSubmit={doSubmit}
      invalid={invalid || !token}
    >
      {children}

      <FormField label={<Trans>Verification code</Trans>}>
        <InputToken
          name="code"
          enterKeyHint="done"
          required
          autoFocus={true}
          onToken={(value) => {
            ctrlRef.current?.reset()
            setToken(value)
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
