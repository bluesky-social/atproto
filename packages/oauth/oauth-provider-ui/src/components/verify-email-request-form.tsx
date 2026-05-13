import { Trans } from '@lingui/react/macro'
import {
  FormCardAsync,
  FormCardAsyncProps,
} from '#/components/forms/form-card-async.tsx'
import { Override } from '#/lib/util.ts'

export type VerifyEmailRequestFormProps = Override<
  Omit<FormCardAsyncProps, 'submitLabel' | 'children'>,
  {
    email: string
    onSubmit: (signal: AbortSignal) => void | PromiseLike<void>
  }
>

export function VerifyEmailRequestForm({
  email,
  onSubmit,
  ...props
}: VerifyEmailRequestFormProps) {
  return (
    <FormCardAsync
      {...props}
      onSubmit={onSubmit}
      submitLabel={<Trans context="EmailVerify">Send verification code</Trans>}
    >
      <p>
        <Trans context="EmailVerify">
          We'll send a verification code to <strong>{email}</strong>. Enter it
          on the next step to confirm that you own this address.
        </Trans>
      </p>
    </FormCardAsync>
  )
}
