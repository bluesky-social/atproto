import { Trans, useLingui } from '@lingui/react/macro'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'

export type ResetPasswordRequestData = { email: string }

export type ResetPasswordRequestFormProps = Omit<
  FormShellProps<ResetPasswordRequestData>,
  'onSubmit'
> & {
  emailDefault?: string
  handler: (
    data: ResetPasswordRequestData,
    signal: AbortSignal,
  ) => void | PromiseLike<void>
}

export function ResetPasswordRequestForm({
  emailDefault,
  handler,
  ...props
}: ResetPasswordRequestFormProps) {
  const { t } = useLingui()

  return (
    <FormShell<ResetPasswordRequestData>
      {...props}
      onSubmit={(values, signal) => handler({ email: values.email }, signal)}
    >
      <EmailField
        name="email"
        required
        defaultValue={emailDefault ?? ''}
        label={<Trans>Email address</Trans>}
        placeholder={t`Enter your email address`}
        title={t`Email address`}
        autoFocus
      />
    </FormShell>
  )
}
