import { useCallback, useRef, useState } from 'react'
import { Fieldset } from '../../../components/forms/fieldset'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async'
import { InputEmailAddress } from '../../../components/forms/input-email-address'
import { useRandomString } from '../../../hooks/use-random-string'
import { mergeRefs } from '../../../lib/ref'
import { Override } from '../../../lib/util'

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
  const emailAriaId = useRandomString({ prefix: 'reset-pwd-email-' })
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
      <Fieldset label="Email address">
        <InputEmailAddress
          name="email"
          placeholder="Enter your email address"
          aria-label={emailAriaId}
          title="Email address"
          required
          autoFocus={true}
          value={email}
          onEmail={(email) => {
            ctrlRef.current?.reset()
            setEmail(email)
          }}
        />
        <p id={emailAriaId} className="text-sm mt-1">
          Enter the email you used to create your account. We\'ll send you a
          "reset code" so you can set a new password.
        </p>
      </Fieldset>
    </FormCardAsync>
  )
}
