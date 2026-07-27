import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useForm } from 'react-hook-form'
import { EmailField } from '#/components/forms/fields/email-field.tsx'
import {
  FormShell,
  type FormShellProps,
} from '#/components/forms/form-shell.tsx'
import {
  type ResetPasswordRequestValues,
  resetPasswordRequestSchema,
} from '#/lib/form-schemas.ts'

export type ResetPasswordRequestData = { email: string }

export type ResetPasswordRequestFormProps = Omit<
  FormShellProps<ResetPasswordRequestValues>,
  'form' | 'onSubmit'
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

  const form = useForm<ResetPasswordRequestValues>({
    resolver: zodResolver(resetPasswordRequestSchema),
    mode: 'onBlur',
    defaultValues: { email: emailDefault ?? '' },
  })

  return (
    <FormShell
      {...props}
      form={form}
      onSubmit={(values, signal) => handler({ email: values.email }, signal)}
    >
      <EmailField
        control={form.control}
        name="email"
        label={<Trans>Email address</Trans>}
        placeholder={t`Enter your email address`}
        title={t`Email address`}
        required
        autoFocus
      />
    </FormShell>
  )
}
