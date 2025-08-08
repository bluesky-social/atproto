import { Trans, useLingui } from '@lingui/react/macro'
import { useCallback, useRef, useState } from 'react'
import { Fieldset } from '../../../components/forms/fieldset.tsx'
import {
  AsyncActionController,
  FormCardAsync,
  FormCardAsyncProps,
} from '../../../components/forms/form-card-async.tsx'
import { InputEmailAddress } from '../../../components/forms/input-email-address.tsx'
import { Admonition } from '../../../components/utils/admonition.tsx'
import { useRandomString } from '../../../hooks/use-random-string.ts'
import { mergeRefs } from '../../../lib/ref.ts'
import { Override } from '../../../lib/util.ts'

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
      <Fieldset label={<Trans>Email address</Trans>}>
        <InputEmailAddress
          name="email"
          placeholder={t`Enter your email address`}
          aria-labelledby={emailAriaId}
          title={t`Email address`}
          required
          autoFocus={true}
          value={email}
          onEmail={(email) => {
            ctrlRef.current?.reset()
            setEmail(email)
          }}
        />
        <Admonition type="status" id={emailAriaId}>
          <Trans>
            Enter the email you used to create your account. We'll send you a
            "reset code" so you can set a new password.
          </Trans>
        </Admonition>
      </Fieldset>
    </FormCardAsync>
  )
}
