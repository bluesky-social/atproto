import { Trans, useLingui } from '@lingui/react/macro'
import { useCallback, useRef, useState } from 'react'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { FormField } from '#/components/forms/form-field'
import { InputEmailAddress } from '#/components/forms/input-email-address.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { Override } from '#/lib/util.ts'

export type ResetPasswordRequestFormProps = Override<
  Omit<FormCardAsyncProps, 'children'>,
  {
    emailDefault?: string
    onSubmit: (
      data: { email: string },
      signal: AbortSignal,
    ) => void | PromiseLike<void>
  }
>

export function ResetPasswordRequestForm({
  emailDefault,
  onSubmit,

  // FormCardAsyncProps
  invalid,
  ref,
  ...props
}: ResetPasswordRequestFormProps) {
  const { t } = useLingui()
  const [email, setEmail] = useState(emailDefault)

  const ctrlRef = useRef<AsyncActionController>(null)

  const doSubmit = useCallback(
    (signal: AbortSignal) => {
      if (email) return onSubmit({ email }, signal)
    },
    [email, onSubmit],
  )

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, ctrlRef])}
      invalid={invalid || !email}
      onSubmit={doSubmit}
    >
      <FormField label={<Trans>Email address</Trans>}>
        <InputEmailAddress
          name="email"
          placeholder={t`Enter your email address`}
          title={t`Email address`}
          required
          autoFocus={true}
          value={email}
          onEmail={(email) => {
            ctrlRef.current?.reset()
            setEmail(email)
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
