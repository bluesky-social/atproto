import { Trans, useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
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
    onSubmit: (data: { email: string }) => void | PromiseLike<void>
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

  const formRef = useRef<HTMLFormElement>(null)

  return (
    <FormCardAsync
      {...props}
      ref={mergeRefs([ref, formRef])}
      invalid={!email || invalid}
      onSubmit={async () => {
        if (email) await onSubmit({ email })
      }}
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
            formRef.current?.reset()
            setEmail(email)
          }}
        />
      </FormField>
    </FormCardAsync>
  )
}
